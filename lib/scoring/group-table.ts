// Tabla de clasificación de un grupo a partir de marcadores predichos.
//
// Función pura y compartida: la UI del orden de grupo la usa para detectar
// empates reales (y obligar al desempate manual, scoring-rules.md §2.3 / ADR
// 0007) y el motor de scoring del slice 5 la reutiliza para clasificar el grupo
// real con los mismos criterios.
//
// Solo se contabilizan los partidos con AMBOS goles presentes; los huecos no
// suman, de modo que un grupo a medio rellenar produce una tabla parcial sin
// reventar.

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

export type GroupMatchScoreInput = {
  homeCode: string;
  awayCode: string;
  golesLocal: number | null;
  golesVisitante: number | null;
};

// Fila de la tabla del grupo. Lleva, además de puntos, goles a favor/en contra
// y su diferencia para poder aplicar la cadena de desempate del reglamento:
// puntos → diferencia de goles → goles a favor (ADR 0007).
export type TeamStanding = {
  teamCode: string;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export function computeGroupPoints(
  teamCodes: readonly string[],
  matches: readonly GroupMatchScoreInput[],
): TeamStanding[] {
  const points = new Map<string, number>(teamCodes.map((code) => [code, 0]));
  const goalsFor = new Map<string, number>(teamCodes.map((code) => [code, 0]));
  const goalsAgainst = new Map<string, number>(teamCodes.map((code) => [code, 0]));

  const addPoints = (code: string, value: number) => {
    const current = points.get(code);
    // Ignora marcadores de equipos que no pertenecen al grupo.
    if (current === undefined) {
      return;
    }
    points.set(code, current + value);
  };

  const addGoals = (code: string, scored: number, conceded: number) => {
    const gf = goalsFor.get(code);
    if (gf === undefined) {
      return;
    }
    goalsFor.set(code, gf + scored);
    goalsAgainst.set(code, (goalsAgainst.get(code) ?? 0) + conceded);
  };

  for (const m of matches) {
    if (m.golesLocal === null || m.golesVisitante === null) {
      continue;
    }
    addGoals(m.homeCode, m.golesLocal, m.golesVisitante);
    addGoals(m.awayCode, m.golesVisitante, m.golesLocal);
    if (m.golesLocal > m.golesVisitante) {
      addPoints(m.homeCode, WIN_POINTS);
    } else if (m.golesLocal < m.golesVisitante) {
      addPoints(m.awayCode, WIN_POINTS);
    } else {
      addPoints(m.homeCode, DRAW_POINTS);
      addPoints(m.awayCode, DRAW_POINTS);
    }
  }

  return teamCodes.map((teamCode) => {
    const gf = goalsFor.get(teamCode) ?? 0;
    const ga = goalsAgainst.get(teamCode) ?? 0;
    return {
      teamCode,
      points: points.get(teamCode) ?? 0,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDifference: gf - ga,
    };
  });
}

// Bloques de equipos empatados en TODA la cadena de clasificación: mismos
// puntos, misma diferencia de goles y mismos goles a favor (ADR 0007). Solo
// estos equipos quedan sin orden definido y el formulario pide al usuario que
// los ordene a mano. Si la diferencia de goles o los goles a favor ya separan a
// dos equipos con los mismos puntos, no forman bloque.
//
// Los bloques se devuelven ordenados por la misma cadena (de mejor a peor) y
// cada bloque conserva el orden de entrada de los equipos.
export function findTiedBlocks(standings: readonly TeamStanding[]): string[][] {
  type Bucket = {
    teamCodes: string[];
    points: number;
    goalDifference: number;
    goalsFor: number;
  };
  const byKey = new Map<string, Bucket>();

  for (const s of standings) {
    const key = `${s.points}|${s.goalDifference}|${s.goalsFor}`;
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.teamCodes.push(s.teamCode);
    } else {
      byKey.set(key, {
        teamCodes: [s.teamCode],
        points: s.points,
        goalDifference: s.goalDifference,
        goalsFor: s.goalsFor,
      });
    }
  }

  return [...byKey.values()]
    .filter((b) => b.teamCodes.length >= 2)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor,
    )
    .map((b) => b.teamCodes);
}
