import { describe, expect, it } from 'vitest';

import { podiumCases } from './__fixtures__/podium';
import { scoreKnockoutMatch } from './knockout';
import { scorePodium } from './podium';

// Puntuación del cuadro de honor (scoring-rules.md §3.5). Función PURA: entra el
// podio predicho {champion, runner_up, third} y el oficial, sale un PodiumScore
// por puesto. champion=20, runner_up=12, third=8; ADICIONALES a los del bracket.

describe('scorePodium (§3.5)', () => {
  for (const c of podiumCases) {
    it(c.name, () => {
      expect(scorePodium(c.picks, c.official)).toEqual(c.expected);
    });
  }

  it('el máximo del podio es 40 (20 + 12 + 8)', () => {
    const total = scorePodium(
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    ).reduce((sum, s) => sum + s.points, 0);
    expect(total).toBe(40);
  });

  // No-solapamiento (§3.5): los puntos del podio se SUMAN a los del bracket, no
  // los reemplazan. Acertar al campeón en la final del bracket (25) y como
  // campeón del podio (20) da 45 en total.
  it('acertar la final (bracket 25) + campeón (podio 20) suma 45, sin solaparse', () => {
    const bracketFinal = scoreKnockoutMatch('ARG', {
      phase: 'final',
      realWinnerTeamCode: 'ARG',
      cancelled: false,
    });
    const podioChampion = scorePodium(
      { champion: 'ARG', runner_up: null, third: null },
      { champion: 'ARG', runner_up: 'FRA', third: 'CRO' },
    ).find((s) => s.kind === 'champion');

    expect(bracketFinal.points + (podioChampion?.points ?? 0)).toBe(45);
  });
});
