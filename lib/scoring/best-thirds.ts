// Puntuación de los mejores terceros (scoring-rules.md §3.3). Función PURA: entra
// la selección ordenada del usuario (8 posiciones, null = hueco) y el conjunto
// oficial de 8 terceros (ordenado), sale el desglose. Carga de BD y persistencia:
// en el orquestador (lib/scoring/index.ts).
//
// 3 pts por cada selección acertada entre los 8 reales (membresía, sin importar
// el orden interno) + bonus +5 si se clavan los 8 en el orden exacto. Máx 29.
// Las posiciones vacías NO restan aquí: se reportan en emptyPositions y el
// orquestador las convierte en −1 cada una en la fila penalties (§4, Modelo A).

import { BEST_THIRD_HIT_POINTS, BEST_THIRDS_EXACT_BONUS } from './points';

export type BestThirdsScore = {
  // Selecciones acertadas (equipos que sí están entre los 8 reales).
  hits: number;
  // hits × 3.
  hitPoints: number;
  // +5 si las 8 posiciones coinciden con el orden oficial, 0 en caso contrario.
  exactOrderBonus: number;
  // hitPoints + exactOrderBonus (sin penalización por huecos).
  points: number;
  // Posiciones dejadas vacías, para la fila penalties del orquestador.
  emptyPositions: number;
};

export function scoreBestThirds(
  predicted: ReadonlyArray<string | null>,
  official: ReadonlyArray<string>,
): BestThirdsScore {
  const officialSet = new Set(official);

  let hits = 0;
  let emptyPositions = 0;
  let allExact = true;

  for (let i = 0; i < official.length; i += 1) {
    const pick = predicted[i] ?? null;
    if (pick === null) {
      emptyPositions += 1;
      allExact = false;
      continue;
    }
    if (officialSet.has(pick)) {
      hits += 1;
    }
    if (pick !== official[i]) {
      allExact = false;
    }
  }

  const hitPoints = hits * BEST_THIRD_HIT_POINTS;
  const exactOrderBonus = allExact ? BEST_THIRDS_EXACT_BONUS : 0;
  return {
    hits,
    hitPoints,
    exactOrderBonus,
    points: hitPoints + exactOrderBonus,
    emptyPositions,
  };
}
