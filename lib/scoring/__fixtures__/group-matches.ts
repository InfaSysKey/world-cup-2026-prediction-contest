// Casos canónicos de §3.1 (marcadores de fase de grupos), regla por outcome 1X2
// (ADR 0006). Cada caso es una tripleta predicción + oficial → esperado, con el
// esperado calculado A MANO desde la doc. NO derivar el esperado con la función
// que se testea: este fixture es la red de seguridad.

import type {
  GroupMatchOfficial,
  GroupMatchPrediction,
  GroupMatchReason,
} from '../group-matches';

export type GroupMatchCase = {
  name: string;
  prediction: GroupMatchPrediction | null;
  official: GroupMatchOfficial;
  expected: { points: number; reason: GroupMatchReason };
};

export const groupMatchCases: GroupMatchCase[] = [
  {
    name: 'marcador exacto → 5',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 1, cancelled: false },
    expected: { points: 5, reason: 'exact' },
  },
  {
    name: 'acierto de 1X2 (victoria local), marcador erróneo → 3',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 3, golesVisitante: 1, cancelled: false },
    expected: { points: 3, reason: 'result' },
  },
  {
    name: 'acierto de 1X2 acertando solo los goles del ganador (2-1 vs 2-0) → 3 (ADR 0006)',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 0, cancelled: false },
    expected: { points: 3, reason: 'result' },
  },
  {
    name: 'empate predicho y empate real, marcador distinto (1-1 vs 2-2) → 3',
    prediction: { golesLocal: 1, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 2, cancelled: false },
    expected: { points: 3, reason: 'result' },
  },
  {
    name: 'fallas el 1X2 pero aciertas los goles del local (2-1 vs 2-3) → 1',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 2, golesVisitante: 3, cancelled: false },
    expected: { points: 1, reason: 'one_goal' },
  },
  {
    name: 'fallas el 1X2 pero aciertas los goles del visitante (0-0 vs 2-0) → 1',
    prediction: { golesLocal: 0, golesVisitante: 0 },
    official: { golesLocal: 2, golesVisitante: 0, cancelled: false },
    expected: { points: 1, reason: 'one_goal' },
  },
  {
    name: 'fallo total: outcome y goles erróneos (2-1 vs 0-3) → 0',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 0, golesVisitante: 3, cancelled: false },
    expected: { points: 0, reason: 'wrong' },
  },
  {
    name: 'predicción vacía → -1 (penalización §4)',
    prediction: null,
    official: { golesLocal: 2, golesVisitante: 1, cancelled: false },
    expected: { points: -1, reason: 'empty' },
  },
  {
    name: 'partido cancelado (§6.1) → 0, sin penalización',
    prediction: { golesLocal: 2, golesVisitante: 1 },
    official: { golesLocal: 0, golesVisitante: 0, cancelled: true },
    expected: { points: 0, reason: 'cancelled' },
  },
  {
    name: 'partido cancelado con predicción vacía → 0, sin penalización',
    prediction: null,
    official: { golesLocal: 0, golesVisitante: 0, cancelled: true },
    expected: { points: 0, reason: 'cancelled' },
  },
];
