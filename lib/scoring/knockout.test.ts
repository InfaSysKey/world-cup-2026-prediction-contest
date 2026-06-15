import { describe, expect, it } from 'vitest';

import { knockoutCases } from './__fixtures__/knockout';
import { scoreKnockoutMatch } from './knockout';

// Puntuación del marcador de cruces eliminatorios (scoring-rules.md §3.3, v2.0).
// Función PURA: entra el marcador predicho y el oficial al 120' (90'+prórroga,
// sin penaltis), sale { points, reason }. 5 (exacto) / 3 (signo 1X2) / 0 (resto).
// El acierto del ganador del cruce (quien pasa, por penaltis si fuera) NO se mide
// aquí — vive en team_advancement.

describe('scoreKnockoutMatch (§3.3)', () => {
  for (const c of knockoutCases) {
    it(c.name, () => {
      expect(scoreKnockoutMatch(c.prediction, c.official)).toEqual(c.expected);
    });
  }

  it('empate al 120\' (decidido en penaltis): el "signo 1X2" es empate, no "gana X"', () => {
    // Final real 2-2 al 120' (FRA gana por penaltis). Usuario A predijo 2-2 con
    // ganador FRA: acierta exacto del marcador → 5. Los 2 pts de "Equipo
    // clasificado para final" se calculan aparte en team_advancement.
    expect(
      scoreKnockoutMatch(
        { golesLocal: 2, golesVisitante: 2 },
        { golesLocal: 2, golesVisitante: 2, cancelled: false },
      ),
    ).toEqual({ points: 5, reason: 'exact' });

    // Usuario B predijo 1-0 a favor del local: falla 1X2 (predijo local; real
    // empate) → 0 pts en bracket. Otra vez team_advancement va aparte.
    expect(
      scoreKnockoutMatch(
        { golesLocal: 1, golesVisitante: 0 },
        { golesLocal: 2, golesVisitante: 2, cancelled: false },
      ),
    ).toEqual({ points: 0, reason: 'wrong' });
  });

  it('el máximo por cruce es 5 (exacto), independientemente de la fase', () => {
    const exactScore = scoreKnockoutMatch(
      { golesLocal: 3, golesVisitante: 1 },
      { golesLocal: 3, golesVisitante: 1, cancelled: false },
    );
    expect(exactScore.points).toBe(5);
  });
});
