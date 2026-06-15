import { describe, expect, it } from 'vitest';

import { groupStandingCases } from './__fixtures__/group-standings';
import { scoreGroupStanding } from './group-standings';

// Puntuación del orden de cada grupo (scoring-rules.md §3.2, v2.0 del Excel,
// ADR 0009). Función PURA: entra el orden predicho (4 posiciones, null = hueco)
// y el orden oficial, sale el desglose. 2/2/1/1 por posición, sin bonus por
// orden completo. Los huecos no penalizan.

describe('scoreGroupStanding (§3.2)', () => {
  for (const c of groupStandingCases) {
    it(c.name, () => {
      expect(scoreGroupStanding(c.predicted, c.official)).toEqual(c.expected);
    });
  }

  it('el máximo por grupo en v2.0 es 6 (2+2+1+1, sin bonus)', () => {
    const max = Math.max(
      ...groupStandingCases.map(
        (c) => scoreGroupStanding(c.predicted, c.official).points,
      ),
    );
    expect(max).toBe(6);
  });

  it('points es solo aciertos; emptyPositions se reporta para el banner pero no resta', () => {
    const allEmpty = scoreGroupStanding(
      [null, null, null, null],
      ['A1', 'A2', 'A3', 'A4'],
    );
    expect(allEmpty.points).toBe(0);
    expect(allEmpty.emptyPositions).toBe(4);
  });
});
