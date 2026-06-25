// Desempates FIFA para clasificación de grupo y para mejores terceros. Se
// implementa la cadena oficial FIFA del Mundial:
//
//   1. Puntos (3 victoria, 1 empate, 0 derrota).
//   2. Diferencia de goles.
//   3. Goles a favor.
//   4. (Solo dentro de un mismo grupo) "Mini-liga" entre los equipos
//      empatados: puntos, diferencia de goles, goles a favor solo
//      contabilizando los partidos jugados entre ellos.
//   5. Disciplina (tarjetas amarillas/rojas).            ← NO disponible.
//   6. Sorteo.                                            ← NO automatizable.
//
// openfootball NO trae datos de tarjetas, por lo que cuando el algoritmo llega
// al paso 5 marca el bloque empatado como "pendiente admin" y lo deja sin
// ordenar; el orquestador escribe `actual_group_standings` solo de los blocks
// que pudieron resolverse y loguea los pendientes para que el admin los cierre
// en /admin/clasificaciones.

import {
  computeGroupPoints,
  type GroupMatchScoreInput,
  type TeamStanding,
} from '@/lib/scoring/group-table';

// Marca un equipo individual o un bloque de equipos cuando el orden no se
// pudo determinar por completo con los criterios disponibles.
export type ResolvedRanking = {
  // Equipos ordenados de 1.º a último, según los criterios FIFA aplicables.
  ordered: string[];
  // Bloques de equipos que quedaron empatados después de aplicar TODOS los
  // criterios disponibles (puntos, GD, GF, head-to-head). Solo se incluyen
  // bloques de tamaño ≥ 2 que no pudieron desempatarse sin disciplina/sorteo.
  // Si está vacío, el ranking es totalmente determinista.
  pendingTiebreak: string[][];
};

// Para mejores terceros: no aplica head-to-head (los equipos están en grupos
// distintos), así que el desempate termina en GF.
export function rankByPointsGdGf(
  standings: ReadonlyArray<TeamStanding>,
): ResolvedRanking {
  const sorted = [...standings].sort(comparePtsGdGf);
  const pendingTiebreak = collectTiedRunsByPtsGdGf(sorted);
  return { ordered: sorted.map((s) => s.teamCode), pendingTiebreak };
}

// Para clasificación de un grupo: tras ordenar por pts→GD→GF, los bloques
// empatados se intentan desempatar con una "mini-liga" entre ellos.
export function rankGroup(
  groupTeamCodes: readonly string[],
  groupMatches: readonly GroupMatchScoreInput[],
): ResolvedRanking {
  const overall = computeGroupPoints(groupTeamCodes, groupMatches);
  const initial = [...overall].sort(comparePtsGdGf);
  const tied = collectTiedRunsByPtsGdGf(initial);

  // Si no hay empates, terminamos.
  if (tied.length === 0) {
    return { ordered: initial.map((s) => s.teamCode), pendingTiebreak: [] };
  }

  // Para cada bloque empatado, intentamos head-to-head.
  const finalOrder: string[] = [];
  const stillPending: string[][] = [];
  const tiedIndex = new Map<string, number>();
  for (let i = 0; i < tied.length; i += 1) {
    for (const code of tied[i]) {
      tiedIndex.set(code, i);
    }
  }

  // Recorremos el ranking inicial en orden, insertando bloques resueltos o
  // marcándolos como pendientes.
  const processedBlocks = new Set<number>();
  for (const standing of initial) {
    const blockIdx = tiedIndex.get(standing.teamCode);
    if (blockIdx === undefined) {
      finalOrder.push(standing.teamCode);
      continue;
    }
    if (processedBlocks.has(blockIdx)) {
      continue;
    }
    processedBlocks.add(blockIdx);

    const block = tied[blockIdx];
    const headToHead = applyHeadToHead(block, groupMatches);
    if (headToHead.pendingTiebreak.length === 0) {
      finalOrder.push(...headToHead.ordered);
    } else {
      // Si head-to-head desempató parcialmente, los equipos que sí se
      // separaron se intercalan en orden; los que siguen empatados quedan
      // pendientes. headToHead.ordered ya está en el orden parcial.
      finalOrder.push(...headToHead.ordered);
      stillPending.push(...headToHead.pendingTiebreak);
    }
  }

  return { ordered: finalOrder, pendingTiebreak: stillPending };
}

// --- Helpers internos ---

function comparePtsGdGf(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference)
    return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
}

function collectTiedRunsByPtsGdGf(
  sorted: readonly TeamStanding[],
): string[][] {
  const blocks: string[][] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j].points === sorted[i].points &&
      sorted[j].goalDifference === sorted[i].goalDifference &&
      sorted[j].goalsFor === sorted[i].goalsFor
    ) {
      j += 1;
    }
    if (j - i >= 2) {
      blocks.push(sorted.slice(i, j).map((s) => s.teamCode));
    }
    i = j;
  }
  return blocks;
}

// Mini-liga entre los equipos empatados: recomputa pts/GD/GF solo con los
// partidos jugados entre ellos. Devuelve el orden y, si quedan empates en la
// mini-liga, los bloques pendientes.
function applyHeadToHead(
  tiedTeams: readonly string[],
  allMatches: readonly GroupMatchScoreInput[],
): ResolvedRanking {
  const tiedSet = new Set(tiedTeams);
  const internalMatches = allMatches.filter(
    (m) => tiedSet.has(m.homeCode) && tiedSet.has(m.awayCode),
  );
  const miniStandings = computeGroupPoints(tiedTeams, internalMatches);
  const sorted = [...miniStandings].sort(comparePtsGdGf);
  const stillTied = collectTiedRunsByPtsGdGf(sorted);
  return { ordered: sorted.map((s) => s.teamCode), pendingTiebreak: stillTied };
}
