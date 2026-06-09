import { describe, expect, it } from 'vitest';

import { scorePenalties } from './penalties';

// Penalización por porra incompleta (scoring-rules.md §4). −1 por cada hueco en
// las categorías 3.1–3.3. Los vacíos en bracket/podio/premios no penalizan: la
// función no los recibe, así que es imposible penalizarlos por construcción.

describe('scorePenalties (§4)', () => {
  it('sin huecos → 0', () => {
    expect(
      scorePenalties({
        groupMatchGaps: 0,
        groupStandingGaps: 0,
        bestThirdGaps: 0,
      }),
    ).toEqual({ totalGaps: 0, points: 0 });
  });

  it('3 marcadores de grupos vacíos → -3', () => {
    expect(
      scorePenalties({
        groupMatchGaps: 3,
        groupStandingGaps: 0,
        bestThirdGaps: 0,
      }),
    ).toEqual({ totalGaps: 3, points: -3 });
  });

  it('mezcla de huecos en 3.1 + 3.2 + 3.3 se suman a -1 cada uno', () => {
    expect(
      scorePenalties({
        groupMatchGaps: 2,
        groupStandingGaps: 1,
        bestThirdGaps: 4,
      }),
    ).toEqual({ totalGaps: 7, points: -7 });
  });

  it('huecos solo en clasificación y terceros → penaliza ambos', () => {
    expect(
      scorePenalties({
        groupMatchGaps: 0,
        groupStandingGaps: 5,
        bestThirdGaps: 8,
      }),
    ).toEqual({ totalGaps: 13, points: -13 });
  });

  it('porra completa de un máximo teórico (todos los huecos posibles) penaliza -1 por hueco', () => {
    // 72 marcadores + 48 posiciones de grupo + 8 terceros = 128 huecos máximos.
    expect(
      scorePenalties({
        groupMatchGaps: 72,
        groupStandingGaps: 48,
        bestThirdGaps: 8,
      }),
    ).toEqual({ totalGaps: 128, points: -128 });
  });
});
