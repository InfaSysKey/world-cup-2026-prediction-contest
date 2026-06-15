// Ranking general y desempates (scoring-rules.md §7, v2.0). Funciones PURAS:
// entran las métricas agregadas de cada jugador (extraídas del desglose de
// `scores`), sale el orden con su rango. No tocan BD ni React.
//
// El criterio 8 (sorteo público) NO se aleatoriza en código: los empates que
// sobreviven a los 7 criterios anteriores quedan con el MISMO rango y
// `needsDraw=true`, para que el admin los resuelva con random.org (§7.8). El
// orden de salida entre empatados genuinos es estable (por nickname) solo para
// que el render sea determinista, sin valor de ranking.

import type { ScoreCategory } from '@/lib/db';

// Las 8 magnitudes que §7 usa para ordenar (puntos totales + los 7 criterios de
// desempate v2.0).
export type RankingMetrics = {
  totalPoints: number;
  exactGroupMatches: number; // §7.1
  exactKnockoutMatches: number; // §7.2
  teamAdvancementHits: number; // §7.3
  championHit: boolean; // §7.4
  runnerUpHit: boolean; // §7.5
  thirdHit: boolean; // §7.6
  awardHits: number; // §7.7
};

export type RankingPlayer = {
  userId: number;
  nickname: string;
  metrics: RankingMetrics;
};

export type RankedPlayer = RankingPlayer & {
  // 1-based; los empatados genuinos comparten rango (ranking de competición: 1,2,2,4).
  rank: number;
  // true si comparte las 8 métricas con otro jugador → pendiente de sorteo (§7.8).
  needsDraw: boolean;
};

// Fila de `scores` tal como la persiste el orquestador (detail es jsonb → unknown).
export type ScoreRowInput = {
  category: ScoreCategory;
  points: number;
  detail: unknown;
};

// --- Lectura segura del detail jsonb (unknown), sin `any` ni `as` ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function getPath(detail: unknown, ...keys: readonly string[]): unknown {
  let current = detail;
  for (const key of keys) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === 'string')
    : [];
}

// Agrega las filas de `scores` de UN usuario a las métricas de §7. La forma del
// `detail` por categoría la fija compute.ts; aquí solo se lee con narrowing.
export function extractRankingMetrics(
  rows: readonly ScoreRowInput[],
): RankingMetrics {
  const detailByCategory = new Map<ScoreCategory, unknown>();
  let totalPoints = 0;
  for (const row of rows) {
    totalPoints += row.points;
    detailByCategory.set(row.category, row.detail);
  }

  // §7.3 — suma de hits en todas las fases de team_advancement.
  const byPhase = getPath(detailByCategory.get('team_advancement'), 'byPhase');
  const teamAdvancementHits = Array.isArray(byPhase)
    ? byPhase.reduce<number>(
        (sum, entry) =>
          sum + asNumber(isRecord(entry) ? entry.hits : undefined),
        0,
      )
    : 0;

  const podiumHits = asStringArray(getPath(detailByCategory.get('podium'), 'hits'));

  return {
    totalPoints,
    exactGroupMatches: asNumber(
      getPath(detailByCategory.get('group_matches'), 'reasons', 'exact'),
    ),
    exactKnockoutMatches: asNumber(
      getPath(detailByCategory.get('bracket'), 'reasons', 'exact'),
    ),
    teamAdvancementHits,
    championHit: podiumHits.includes('champion'),
    runnerUpHit: podiumHits.includes('runner_up'),
    thirdHit: podiumHits.includes('third'),
    awardHits: asStringArray(getPath(detailByCategory.get('awards'), 'hits'))
      .length,
  };
}

// --- Desempates: los criterios de §7 v2.0 como lista ordenada de magnitudes ---

// Cada criterio mapea las métricas a un número "más es mejor". El orden de la
// lista ES el orden de prioridad de §7; un criterio temprano manda sobre todos
// los posteriores (no se suman).
const RANKING_CRITERIA: readonly ((m: RankingMetrics) => number)[] = [
  (m) => m.totalPoints, // §7: puntos totales
  (m) => m.exactGroupMatches, // §7.1
  (m) => m.exactKnockoutMatches, // §7.2
  (m) => m.teamAdvancementHits, // §7.3
  (m) => (m.championHit ? 1 : 0), // §7.4
  (m) => (m.runnerUpHit ? 1 : 0), // §7.5
  (m) => (m.thirdHit ? 1 : 0), // §7.6
  (m) => m.awardHits, // §7.7
];

// >0 si b va por delante de a; 0 si empatan en las 8 métricas (→ sorteo §7.8).
function compareMetrics(a: RankingMetrics, b: RankingMetrics): number {
  for (const criterion of RANKING_CRITERIA) {
    const diff = criterion(b) - criterion(a);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function rankPlayers(
  players: readonly RankingPlayer[],
): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => {
    const byMetrics = compareMetrics(a.metrics, b.metrics);
    if (byMetrics !== 0) {
      return byMetrics;
    }
    // Empate genuino (§7.8): desempate de presentación estable, sin valor de ranking.
    return a.nickname.localeCompare(b.nickname);
  });

  const ranked: RankedPlayer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const tiedWithPrev =
      i > 0 && compareMetrics(sorted[i - 1].metrics, current.metrics) === 0;
    const tiedWithNext =
      i < sorted.length - 1 &&
      compareMetrics(current.metrics, sorted[i + 1].metrics) === 0;
    ranked.push({
      ...current,
      // Ranking de competición (1,2,2,4): el empatado hereda el rango del primero
      // de su grupo; el siguiente bloque salta al índice+1.
      rank: tiedWithPrev ? ranked[i - 1].rank : i + 1,
      needsDraw: tiedWithPrev || tiedWithNext,
    });
  }
  return ranked;
}

// Snapshot { userId: rank } del ranking, base de los deltas ▲/▼ (data-model
// §5.5/§6.1). Reusa rankPlayers para no duplicar el desempate de §7. Las claves
// son strings porque van a una columna jsonb.
export function snapshotPositions(
  players: readonly RankingPlayer[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of rankPlayers(players)) {
    out[String(p.userId)] = p.rank;
  }
  return out;
}
