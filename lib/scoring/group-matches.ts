// Puntuación de los marcadores de fase de grupos (scoring-rules.md §3.1, v2.2).
// Función PURA: entra la predicción del usuario (o null si la dejó vacía) y el
// resultado oficial, sale { points, reason }. La persistencia y la carga de BD
// las hace el orquestador (lib/scoring/index.ts).
//
// Regla canónica del Excel (ADR 0009 + ADR 0012 que corrige el sumatorio):
//   - marcador exacto (signo 1X2 + exacto)         → 3 + 5 = 8  (exact)
//   - signo 1X2 acertado, marcador no exacto       → 3          (result)
//   - signo fallado                                → 0          (wrong)
//   - predicción vacía                             → 0          (empty, sin penalización)
//   - partido cancelado/anulado (§6.1)             → 0          (cancelled)

import { GROUP_MATCH_POINTS } from './points';

export type GroupMatchReason =
  | 'exact'
  | 'result'
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
  // Partido anulado por retirada de un equipo (§6.1): no suma.
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
    return { points: 0, reason: 'empty' };
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
  return { points: GROUP_MATCH_POINTS.wrong, reason: 'wrong' };
}
