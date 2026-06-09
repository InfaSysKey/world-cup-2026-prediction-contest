import { describe, expect, it } from 'vitest';

import { groupStandingCases } from './__fixtures__/group-standings';
import { scoreGroupStanding } from './group-standings';

// Puntuación del orden de cada grupo (scoring-rules.md §3.2). Función PURA: entra
// el orden predicho (4 posiciones, null = hueco) y el orden oficial, sale el
// desglose. Los huecos NO restan aquí: emptyPositions lo consume la fila
// penalties del orquestador (§4, Modelo A).

describe('scoreGroupStanding (§3.2)', () => {
  for (const c of groupStandingCases) {
    it(c.name, () => {
      expect(scoreGroupStanding(c.predicted, c.official)).toEqual(c.expected);
    });
  }

  it('el bonus solo se concede con las 4 posiciones correctas (máximo 15)', () => {
    const max = Math.max(
      ...groupStandingCases.map(
        (c) => scoreGroupStanding(c.predicted, c.official).points,
      ),
    );
    expect(max).toBe(15);
  });

  it('points nunca incluye penalización por huecos (solo aciertos + bonus)', () => {
    const allEmpty = scoreGroupStanding([null, null, null, null], [
      'A1',
      'A2',
      'A3',
      'A4',
    ]);
    expect(allEmpty.points).toBe(0);
    expect(allEmpty.emptyPositions).toBe(4);
  });
});
