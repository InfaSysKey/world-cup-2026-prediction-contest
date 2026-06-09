// Casos canónicos de §3.2 (clasificación de cada grupo). Tripleta predicción +
// oficial → esperado, calculado a mano desde la doc. El orden oficial fijo es
// [A1, A2, A3, A4] (1.º…4.º); cada caso varía la predicción del usuario.
// Puntos por posición acertada: 1.º=4, 2.º=3, 3.º=2, 4.º=1; bonus +5 si las 4.

import type { GroupStandingScore } from '../group-standings';

export type GroupStandingCase = {
  name: string;
  // index 0 = 1.º … index 3 = 4.º; null = posición vacía.
  predicted: ReadonlyArray<string | null>;
  official: readonly [string, string, string, string];
  expected: GroupStandingScore;
};

const OFFICIAL = ['A1', 'A2', 'A3', 'A4'] as const;

export const groupStandingCases: GroupStandingCase[] = [
  {
    name: 'orden completo de los 4 → 10 + bonus 5 = 15',
    predicted: ['A1', 'A2', 'A3', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 10, exactOrderBonus: 5, points: 15, emptyPositions: 0 },
  },
  {
    name: 'solo el 1.º acertado → 4',
    predicted: ['A1', 'A3', 'A4', 'A2'],
    official: OFFICIAL,
    expected: { positionPoints: 4, exactOrderBonus: 0, points: 4, emptyPositions: 0 },
  },
  {
    name: 'solo el 2.º acertado → 3',
    predicted: ['A4', 'A2', 'A1', 'A3'],
    official: OFFICIAL,
    expected: { positionPoints: 3, exactOrderBonus: 0, points: 3, emptyPositions: 0 },
  },
  {
    name: 'solo el 3.º acertado → 2',
    predicted: ['A2', 'A4', 'A3', 'A1'],
    official: OFFICIAL,
    expected: { positionPoints: 2, exactOrderBonus: 0, points: 2, emptyPositions: 0 },
  },
  {
    name: 'solo el 4.º acertado → 1',
    predicted: ['A2', 'A3', 'A1', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 1, exactOrderBonus: 0, points: 1, emptyPositions: 0 },
  },
  {
    name: 'orden parcial: 1.º y 3.º bien (2 de 4) → 6, sin bonus',
    predicted: ['A1', 'A4', 'A3', 'A2'],
    official: OFFICIAL,
    expected: { positionPoints: 6, exactOrderBonus: 0, points: 6, emptyPositions: 0 },
  },
  {
    name: 'una posición vacía (2.º), resto correcto → 7, sin bonus, 1 hueco',
    predicted: ['A1', null, 'A3', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 7, exactOrderBonus: 0, points: 7, emptyPositions: 1 },
  },
  {
    name: 'las 4 posiciones vacías → 0 puntos, 4 huecos',
    predicted: [null, null, null, null],
    official: OFFICIAL,
    expected: { positionPoints: 0, exactOrderBonus: 0, points: 0, emptyPositions: 4 },
  },
  {
    name: 'orden completamente invertido → 0, sin huecos',
    predicted: ['A4', 'A3', 'A2', 'A1'],
    official: OFFICIAL,
    expected: { positionPoints: 0, exactOrderBonus: 0, points: 0, emptyPositions: 0 },
  },
];
