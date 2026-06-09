// Penalización por porra incompleta (scoring-rules.md §4). Función PURA: entra el
// número de huecos (predicciones vacías) en cada una de las categorías 3.1–3.3 y
// sale el total penalizado. La detección de qué cuenta como hueco (y la exclusión
// de los partidos cancelados, §6.1) la hace el orquestador, que es quien conoce
// el catálogo; aquí solo se aplica la tarifa −1 por hueco.
//
// IMPORTANTE: §4 solo penaliza vacíos en fase de grupos (3.1), clasificación de
// grupos (3.2) y mejores terceros (3.3). Los vacíos en bracket, podio y premios
// NO penalizan (valen 0), por eso esta función ni siquiera los recibe.

import { EMPTY_PREDICTION_PENALTY } from './points';

export type PenaltyGaps = {
  // Partidos de grupos sin marcador (excluidos los cancelados §6.1).
  groupMatchGaps: number;
  // Posiciones de clasificación de grupo vacías.
  groupStandingGaps: number;
  // Posiciones de mejores terceros vacías.
  bestThirdGaps: number;
};

export type PenaltyScore = {
  totalGaps: number;
  // EMPTY_PREDICTION_PENALTY × totalGaps (≤ 0).
  points: number;
};

export function scorePenalties(gaps: PenaltyGaps): PenaltyScore {
  const totalGaps =
    gaps.groupMatchGaps + gaps.groupStandingGaps + gaps.bestThirdGaps;
  // Evita el -0 (totalGaps 0 × -1) que rompe igualdades estrictas.
  const points = totalGaps === 0 ? 0 : totalGaps * EMPTY_PREDICTION_PENALTY;
  return { totalGaps, points };
}
