// Casos canónicos de §3.3 (mejores terceros). Tripleta predicción + oficial →
// esperado, calculado a mano desde la doc. El conjunto oficial de 8 (ordenado)
// es [T1…T8]; los códigos Xn NO están entre los 8 reales. 3 pts por cada acierto
// (membresía, sin importar orden) + bonus +5 si los 8 en orden exacto. Máx 29.

import type { BestThirdsScore } from '../best-thirds';

export type BestThirdsCase = {
  name: string;
  // 8 posiciones; null = hueco.
  predicted: ReadonlyArray<string | null>;
  official: readonly [string, string, string, string, string, string, string, string];
  expected: BestThirdsScore;
};

const OFFICIAL = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;

export const bestThirdsCases: BestThirdsCase[] = [
  {
    name: 'los 8 en orden exacto → 24 + bonus 5 = 29',
    predicted: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'],
    official: OFFICIAL,
    expected: { hits: 8, hitPoints: 24, exactOrderBonus: 5, points: 29, emptyPositions: 0 },
  },
  {
    name: 'los 8 acertados pero en otro orden → 24, sin bonus',
    predicted: ['T8', 'T7', 'T6', 'T5', 'T4', 'T3', 'T2', 'T1'],
    official: OFFICIAL,
    expected: { hits: 8, hitPoints: 24, exactOrderBonus: 0, points: 24, emptyPositions: 0 },
  },
  {
    name: 'orden exacto salvo los dos últimos intercambiados → 24, sin bonus',
    predicted: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T8', 'T7'],
    official: OFFICIAL,
    expected: { hits: 8, hitPoints: 24, exactOrderBonus: 0, points: 24, emptyPositions: 0 },
  },
  {
    name: '5 de 8 acertados sin orden → 15, sin bonus',
    predicted: ['T5', 'T1', 'X1', 'T8', 'X2', 'T3', 'X3', 'T2'],
    official: OFFICIAL,
    expected: { hits: 5, hitPoints: 15, exactOrderBonus: 0, points: 15, emptyPositions: 0 },
  },
  {
    name: '7 aciertos y 1 hueco → 21, sin bonus, 1 hueco',
    predicted: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', null],
    official: OFFICIAL,
    expected: { hits: 7, hitPoints: 21, exactOrderBonus: 0, points: 21, emptyPositions: 1 },
  },
  {
    name: '0 aciertos (todos fuera de los 8 reales) → 0, sin huecos',
    predicted: ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8'],
    official: OFFICIAL,
    expected: { hits: 0, hitPoints: 0, exactOrderBonus: 0, points: 0, emptyPositions: 0 },
  },
  {
    name: 'selección totalmente vacía → 0, 8 huecos',
    predicted: [null, null, null, null, null, null, null, null],
    official: OFFICIAL,
    expected: { hits: 0, hitPoints: 0, exactOrderBonus: 0, points: 0, emptyPositions: 8 },
  },
];
