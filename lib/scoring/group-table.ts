// Tabla de puntos de un grupo a partir de marcadores predichos.
//
// Función pura y compartida: la UI del orden de grupo la usa para detectar
// empates a puntos (y obligar al desempate manual, scoring-rules.md §2.3) y el
// motor de scoring del slice 5 la reutiliza para clasificar el grupo real.
//
// Solo se contabilizan los partidos con AMBOS goles presentes; los huecos no
// suman, de modo que un grupo a medio rellenar produce puntos parciales sin
// reventar.

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

export type GroupMatchScoreInput = {
  homeCode: string;
  awayCode: string;
  golesLocal: number | null;
  golesVisitante: number | null;
};

export type TeamPoints = {
  teamCode: string;
  points: number;
};

export function computeGroupPoints(
  teamCodes: readonly string[],
  matches: readonly GroupMatchScoreInput[],
): TeamPoints[] {
  const points = new Map<string, number>(teamCodes.map((code) => [code, 0]));

  const add = (code: string, value: number) => {
    const current = points.get(code);
    // Ignora marcadores de equipos que no pertenecen al grupo.
    if (current === undefined) {
      return;
    }
    points.set(code, current + value);
  };

  for (const m of matches) {
    if (m.golesLocal === null || m.golesVisitante === null) {
      continue;
    }
    if (m.golesLocal > m.golesVisitante) {
      add(m.homeCode, WIN_POINTS);
    } else if (m.golesLocal < m.golesVisitante) {
      add(m.awayCode, WIN_POINTS);
    } else {
      add(m.homeCode, DRAW_POINTS);
      add(m.awayCode, DRAW_POINTS);
    }
  }

  return teamCodes.map((teamCode) => ({
    teamCode,
    points: points.get(teamCode) ?? 0,
  }));
}

// Bloques de equipos empatados a puntos (cada bloque de 2+ equipos), ordenados
// por puntos descendentes. Estos son exactamente los equipos cuyo orden relativo
// el usuario debe resolver a mano en el sub-componente de desempate.
export function findTiedBlocks(standings: readonly TeamPoints[]): string[][] {
  const byPoints = new Map<number, string[]>();
  for (const { teamCode, points } of standings) {
    const block = byPoints.get(points) ?? [];
    block.push(teamCode);
    byPoints.set(points, block);
  }

  return [...byPoints.entries()]
    .filter(([, block]) => block.length >= 2)
    .sort(([a], [b]) => b - a)
    .map(([, block]) => block);
}
