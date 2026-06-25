// Puntuación del orden de cada grupo (scoring-rules.md §3.2, v2.1). Función PURA:
// entra el orden predicho por el usuario (4 posiciones, null = vacía) y el orden
// oficial del grupo, sale el desglose. Carga de BD y persistencia: en el
// orquestador (lib/scoring/index.ts).
//
// v2.1 canónica (ADR 0010, revisa el 0009): puntos por posición acertada
// 1.º=2, 2.º=2, 3.º=2, 4.º=2. SIN bonus por clavar el orden completo (el Excel
// del organizador no lo lista). Máximo por grupo = 8; total 12 grupos = 96 pts.
// Las posiciones vacías no suman ni restan (la penalización por hueco también
// se elimina en v2.0).

import { GROUP_STANDING_POSITION_POINTS } from './points';

export type GroupStandingScore = {
  // Puntos por posición acertada.
  positionPoints: number;
  // Igual a positionPoints (sin bonus en v2.0). Se conserva el campo por
  // simetría con el resto de scorers y para el `detail` JSON del orquestador.
  points: number;
  // Posiciones dejadas vacías. Se conserva para el `detail` y el banner
  // "PORRA INCOMPLETA"; en v2.0 no penaliza puntos.
  emptyPositions: number;
};

export function scoreGroupStanding(
  predicted: ReadonlyArray<string | null>,
  official: ReadonlyArray<string>,
): GroupStandingScore {
  let positionPoints = 0;
  let emptyPositions = 0;

  for (let i = 0; i < GROUP_STANDING_POSITION_POINTS.length; i += 1) {
    const pick = predicted[i] ?? null;
    if (pick === null) {
      emptyPositions += 1;
      continue;
    }
    if (pick === official[i]) {
      positionPoints += GROUP_STANDING_POSITION_POINTS[i];
    }
  }

  return {
    positionPoints,
    points: positionPoints,
    emptyPositions,
  };
}
