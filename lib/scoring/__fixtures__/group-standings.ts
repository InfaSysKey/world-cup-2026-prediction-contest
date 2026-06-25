// Casos canónicos de §3.2 (clasificación de cada grupo), v2.1 del Excel
// (ADR 0010, revisa el 0009). Tripleta predicción + oficial → esperado,
// calculado a mano. Orden oficial fijo [A1, A2, A3, A4] (1.º…4.º). Puntos por
// posición: 1.º=2, 2.º=2, 3.º=2, 4.º=2. Sin bonus por orden completo.

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
    name: 'orden completo de los 4 → 2+2+2+2 = 8',
    predicted: ['A1', 'A2', 'A3', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 8, points: 8, emptyPositions: 0 },
  },
  {
    name: 'solo el 1.º acertado → 2',
    predicted: ['A1', 'A3', 'A4', 'A2'],
    official: OFFICIAL,
    expected: { positionPoints: 2, points: 2, emptyPositions: 0 },
  },
  {
    name: 'solo el 2.º acertado → 2',
    predicted: ['A4', 'A2', 'A1', 'A3'],
    official: OFFICIAL,
    expected: { positionPoints: 2, points: 2, emptyPositions: 0 },
  },
  {
    name: 'solo el 3.º acertado → 2',
    predicted: ['A2', 'A4', 'A3', 'A1'],
    official: OFFICIAL,
    expected: { positionPoints: 2, points: 2, emptyPositions: 0 },
  },
  {
    name: 'solo el 4.º acertado → 2',
    predicted: ['A2', 'A3', 'A1', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 2, points: 2, emptyPositions: 0 },
  },
  {
    name: 'orden parcial: 1.º y 3.º bien → 2+2 = 4',
    predicted: ['A1', 'A4', 'A3', 'A2'],
    official: OFFICIAL,
    expected: { positionPoints: 4, points: 4, emptyPositions: 0 },
  },
  {
    name: 'una posición vacía (2.º), resto correcto → 2+2+2 = 6, 1 hueco',
    predicted: ['A1', null, 'A3', 'A4'],
    official: OFFICIAL,
    expected: { positionPoints: 6, points: 6, emptyPositions: 1 },
  },
  {
    name: 'las 4 posiciones vacías → 0 puntos, 4 huecos',
    predicted: [null, null, null, null],
    official: OFFICIAL,
    expected: { positionPoints: 0, points: 0, emptyPositions: 4 },
  },
  {
    name: 'orden completamente invertido → 0, sin huecos',
    predicted: ['A4', 'A3', 'A2', 'A1'],
    official: OFFICIAL,
    expected: { positionPoints: 0, points: 0, emptyPositions: 0 },
  },
];
