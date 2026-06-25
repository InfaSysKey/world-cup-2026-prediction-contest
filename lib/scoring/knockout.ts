// Puntuación del marcador de los cruces eliminatorios (scoring-rules.md §3.3,
// v2.2). Función PURA: entra la predicción del marcador del usuario (o null si
// la dejó vacía) y el resultado oficial al 120' (90'+prórroga, sin penaltis),
// sale { points, reason }. La carga de BD y la persistencia las hace el
// orquestador (lib/scoring/index.ts).
//
// Regla canónica del Excel (ADR 0009 + ADR 0012 que corrige el sumatorio):
//   - marcador exacto al 120' (signo + exacto)     → 3 + 5 = 8  (exact)
//   - signo 1X2 acertado al 120', marcador no
//     exacto                                       → 3          (result)
//   - resto                                        → 0          (wrong)
//   - predicción vacía                             → 0          (empty, sin penalización)
//   - cruce cancelado (§6.1)                       → 0          (cancelled)
//
// El acierto del ganador del cruce (quien pasa a la siguiente ronda, decidido
// por penaltis si fuera necesario) NO se mide aquí — vive en la categoría
// `team_advancement` (§3.4).

import { KNOCKOUT_MATCH_POINTS } from './points';

export type KnockoutMatchReason =
  | 'exact'
  | 'result'
  | 'wrong'
  | 'empty'
  | 'cancelled';

export type KnockoutMatchPrediction = {
  golesLocal: number;
  golesVisitante: number;
};

export type KnockoutMatchOfficial = {
  // Goles al final del 90' + prórroga, sin penaltis (data-model.md §3.2).
  golesLocal: number;
  golesVisitante: number;
  // Cruce anulado por retirada de un equipo (§6.1).
  cancelled: boolean;
};

export type KnockoutMatchScore = {
  points: number;
  reason: KnockoutMatchReason;
};

function outcome(local: number, visitante: number): -1 | 0 | 1 {
  return Math.sign(local - visitante) as -1 | 0 | 1;
}

export function scoreKnockoutMatch(
  prediction: KnockoutMatchPrediction | null,
  official: KnockoutMatchOfficial,
): KnockoutMatchScore {
  if (official.cancelled) {
    return { points: 0, reason: 'cancelled' };
  }
  if (prediction === null) {
    return { points: 0, reason: 'empty' };
  }

  const sameLocal = prediction.golesLocal === official.golesLocal;
  const sameVisitante = prediction.golesVisitante === official.golesVisitante;

  if (sameLocal && sameVisitante) {
    return { points: KNOCKOUT_MATCH_POINTS.exact, reason: 'exact' };
  }
  if (
    outcome(prediction.golesLocal, prediction.golesVisitante) ===
    outcome(official.golesLocal, official.golesVisitante)
  ) {
    return { points: KNOCKOUT_MATCH_POINTS.result, reason: 'result' };
  }
  return { points: KNOCKOUT_MATCH_POINTS.wrong, reason: 'wrong' };
}
