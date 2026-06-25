import { describe, expect, it } from 'vitest';

import { groupMatchCases } from './__fixtures__/group-matches';
import { scoreGroupMatch } from './group-matches';

// Puntuación de marcadores de fase de grupos (scoring-rules.md §3.1, v2.2 del
// Excel, ADR 0009 + ADR 0012). Función PURA: entra predicción + oficial, sale
// { points, reason }. 8 exacto (3 signo + 5 exacto) / 3 signo 1X2 sin exacto /
// 0 resto. Sin penalización por hueco. Los casos canónicos viven en el fixture,
// con el esperado calculado a mano desde la doc.

describe('scoreGroupMatch (§3.1)', () => {
  for (const c of groupMatchCases) {
    it(c.name, () => {
      expect(scoreGroupMatch(c.prediction, c.official)).toEqual(c.expected);
    });
  }

  it('un cancelado nunca penaliza, tenga o no predicción', () => {
    const official = { golesLocal: 0, golesVisitante: 0, cancelled: true };
    expect(scoreGroupMatch(null, official).points).toBe(0);
    expect(
      scoreGroupMatch({ golesLocal: 1, golesVisitante: 1 }, official).points,
    ).toBe(0);
  });

  it('el máximo por partido es 8 (signo + exacto, regla acumulativa v2.2)', () => {
    const max = Math.max(
      ...groupMatchCases.map(
        (c) => scoreGroupMatch(c.prediction, c.official).points,
      ),
    );
    expect(max).toBe(8);
  });
});
