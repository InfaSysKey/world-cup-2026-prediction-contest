// Puntuación del orden de cada grupo (scoring-rules.md §3.2). Función PURA: entra
// el orden predicho por el usuario (4 posiciones, null = posición vacía) y el
// orden oficial del grupo, sale el desglose. Carga de BD y persistencia: en el
// orquestador (lib/scoring/index.ts).
//
// Puntos por posición acertada: 1.º=4, 2.º=3, 3.º=2, 4.º=1. Bonus +5 si se clava
// el orden completo de los 4. Máximo por grupo 15; total 12 grupos = 180 pts.
// Las posiciones vacías NO restan aquí: se reportan en emptyPositions y el
// orquestador las convierte en −1 cada una en la fila penalties (§4, Modelo A).

import {
  GROUP_STANDING_EXACT_BONUS,
  GROUP_STANDING_POSITION_POINTS,
} from './points';

export type GroupStandingScore = {
  // Puntos por posición acertada (sin contar el bonus).
  positionPoints: number;
  // +5 si las 4 posiciones del grupo son correctas, 0 en caso contrario.
  exactOrderBonus: number;
  // positionPoints + exactOrderBonus (sin penalización por huecos).
  points: number;
  // Posiciones dejadas vacías, para la fila penalties del orquestador.
  emptyPositions: number;
};

export function scoreGroupStanding(
  predicted: ReadonlyArray<string | null>,
  official: ReadonlyArray<string>,
): GroupStandingScore {
  let positionPoints = 0;
  let emptyPositions = 0;
  let allCorrect = true;

  for (let i = 0; i < GROUP_STANDING_POSITION_POINTS.length; i += 1) {
    const pick = predicted[i] ?? null;
    if (pick === null) {
      emptyPositions += 1;
      allCorrect = false;
      continue;
    }
    if (pick === official[i]) {
      positionPoints += GROUP_STANDING_POSITION_POINTS[i];
    } else {
      allCorrect = false;
    }
  }

  const exactOrderBonus = allCorrect ? GROUP_STANDING_EXACT_BONUS : 0;
  return {
    positionPoints,
    exactOrderBonus,
    points: positionPoints + exactOrderBonus,
    emptyPositions,
  };
}
