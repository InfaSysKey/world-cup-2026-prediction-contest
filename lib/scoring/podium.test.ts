import { describe, expect, it } from 'vitest';

import { podiumCases } from './__fixtures__/podium';
import { scoreKnockoutMatch } from './knockout';
import { scorePodium } from './podium';

// Puntuación del cuadro de honor (scoring-rules.md §3.5, v2.0). champion=30,
// runner_up=20, third=10; son ADICIONALES a los puntos del bracket y de
// team_advancement.

describe('scorePodium (§3.5)', () => {
  for (const c of podiumCases) {
    it(c.name, () => {
      expect(scorePodium(c.picks, c.official)).toEqual(c.expected);
    });
  }

  it('el máximo del podio es 60 (30 + 20 + 10)', () => {
    const total = scorePodium(
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    ).reduce((sum, s) => sum + s.points, 0);
    expect(total).toBe(60);
  });

  // No-solapamiento: los puntos del podio se SUMAN a los del marcador del cruce
  // y a los de team_advancement. Acertar el marcador exacto de la final (bracket
  // 5 en v2.0) + acertar al campeón (podio 30) = 35.
  it('marcador exacto en final (5) + campeón (30) = 35, sin solaparse', () => {
    const bracketFinal = scoreKnockoutMatch(
      { golesLocal: 3, golesVisitante: 0 },
      { golesLocal: 3, golesVisitante: 0, cancelled: false },
    );
    const podioChampion = scorePodium(
      { champion: 'ARG', runner_up: null, third: null },
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    ).find((s) => s.kind === 'champion');

    expect(bracketFinal.points + (podioChampion?.points ?? 0)).toBe(35);
  });
});
