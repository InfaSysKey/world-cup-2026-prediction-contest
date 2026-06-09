// Puntuación de los marcadores de fase de grupos (scoring-rules.md §3.1).
// Función PURA: entra la predicción del usuario (o null si la dejó vacía) y el
// resultado oficial, sale { points, reason }. La persistencia y la carga de BD
// las hace el orquestador (lib/scoring/index.ts).
//
// Regla por outcome 1X2 (ADR 0006):
//   - marcador exacto                              → 5  (exact)
//   - aciertas el 1X2 (mismo ganador o empate)     → 3  (result)
//   - fallas el 1X2 pero aciertas los goles de un
//     equipo                                       → 1  (one_goal)
//   - fallo total                                  → 0  (wrong)
//   - predicción vacía                             → -1 (empty, penalización §4)
//   - partido cancelado/anulado (§6.1)             → 0  (cancelled), sin penalizar

import { EMPTY_PREDICTION_PENALTY, GROUP_MATCH_POINTS } from './points';

export type GroupMatchReason =
  | 'exact'
  | 'result'
  | 'one_goal'
  | 'wrong'
  | 'empty'
  | 'cancelled';

export type GroupMatchPrediction = {
  golesLocal: number;
  golesVisitante: number;
};

export type GroupMatchOfficial = {
  golesLocal: number;
  golesVisitante: number;
  // Partido anulado por retirada de un equipo (§6.1): no suma ni resta.
  cancelled: boolean;
};

export type GroupMatchScore = {
  points: number;
  reason: GroupMatchReason;
};

function outcome(local: number, visitante: number): -1 | 0 | 1 {
  return Math.sign(local - visitante) as -1 | 0 | 1;
}

export function scoreGroupMatch(
  prediction: GroupMatchPrediction | null,
  official: GroupMatchOfficial,
): GroupMatchScore {
  if (official.cancelled) {
    return { points: 0, reason: 'cancelled' };
  }
  if (prediction === null) {
    return { points: EMPTY_PREDICTION_PENALTY, reason: 'empty' };
  }

  const sameLocal = prediction.golesLocal === official.golesLocal;
  const sameVisitante = prediction.golesVisitante === official.golesVisitante;

  if (sameLocal && sameVisitante) {
    return { points: GROUP_MATCH_POINTS.exact, reason: 'exact' };
  }
  if (
    outcome(prediction.golesLocal, prediction.golesVisitante) ===
    outcome(official.golesLocal, official.golesVisitante)
  ) {
    return { points: GROUP_MATCH_POINTS.result, reason: 'result' };
  }
  if (sameLocal || sameVisitante) {
    return { points: GROUP_MATCH_POINTS.oneGoal, reason: 'one_goal' };
  }
  return { points: GROUP_MATCH_POINTS.wrong, reason: 'wrong' };
}
