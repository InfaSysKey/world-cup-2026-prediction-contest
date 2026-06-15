// Casos canónicos de §3.3 (marcador de cruces eliminatorios), v2.0 del Excel
// (ADR 0009). Mismo esquema que grupos, aplicado al marcador al 120'
// (90'+prórroga, sin penaltis): 5 (exacto) / 3 (signo 1X2) / 0 (resto).
//
// El acierto del ganador del cruce (quien pasa, decidido por penaltis si
// fuera necesario) NO se mide aquí — vive en team_advancement.

import type {
  KnockoutMatchOfficial,
  KnockoutMatchPrediction,
  KnockoutMatchReason,
  KnockoutMatchScore,
} from '../knockout';

export type KnockoutCase = {
  name: string;
  prediction: KnockoutMatchPrediction | null;
  official: KnockoutMatchOfficial;
  expected: KnockoutMatchScore;
};

const exact = (
  points: number,
  reason: KnockoutMatchReason,
): KnockoutMatchScore => ({ points, reason });

export const knockoutCases: KnockoutCase[] = [
  {
    name: 'marcador exacto al 120' + "'" + ' → 5',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 1, cancelled: false },
    expected: exact(5, 'exact'),
  },
  {
    name: 'signo 1X2 acertado (victoria local), marcador no exacto → 3',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 3, golesVisitante: 1, cancelled: false },
    expected: exact(3, 'result'),
  },
  {
    name: 'empate predicho y empate al 120' + "'" + ' (decidido en penaltis) → 3',
    prediction: { golesLocal: 1, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 2, cancelled: false },
    expected: exact(3, 'result'),
  },
  {
    name: 'fallo de 1X2 acertando un equipo (2-1 vs 2-3) → 0 (v2.0 no premia diferencia)',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 3, cancelled: false },
    expected: exact(0, 'wrong'),
  },
  {
    name: 'predijo empate, partido real con victoria → 0',
    prediction: { golesLocal: 1, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 0, cancelled: false },
    expected: exact(0, 'wrong'),
  },
  {
    name: 'fallo total: outcome y goles erróneos → 0',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 0, golesVisitante: 3, cancelled: false },
    expected: exact(0, 'wrong'),
  },
  {
    name: 'predicción vacía → 0 (v2.0 no penaliza huecos)',
    prediction: null,
    official: { golesLocal: 1, golesVisitante: 0, cancelled: false },
    expected: exact(0, 'empty'),
  },
  {
    name: 'cruce anulado (§6.1) con predicción → 0',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 0, golesVisitante: 0, cancelled: true },
    expected: exact(0, 'cancelled'),
  },
  {
    name: 'cruce anulado con predicción vacía → 0',
    prediction: null,
    official: { golesLocal: 0, golesVisitante: 0, cancelled: true },
    expected: exact(0, 'cancelled'),
  },
];
