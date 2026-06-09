import { describe, expect, it } from 'vitest';

import { knockoutCases } from './__fixtures__/knockout';
import { scoreKnockoutMatch } from './knockout';

// Puntuación del bracket eliminatorio (scoring-rules.md §3.4, ADR 0003). Función
// PURA: entra el pick del usuario para un cruce y el oficial (fase + ganador real
// + cancelado), sale { points, hit }. El bracket es RÍGIDO: solo puntúa si el
// equipo predicho es exactamente el que ganó ese cruce.

describe('scoreKnockoutMatch (§3.4)', () => {
  for (const c of knockoutCases) {
    it(c.name, () => {
      expect(scoreKnockoutMatch(c.pick, c.official)).toEqual(c.expected);
    });
  }

  // Test explícito de bracket rígido — la regla más fácil de implementar mal.
  // El usuario predijo ESP como ganador de cuartos, pero ESP cayó antes y ese
  // cruce real lo ganó BRA. NO puntúa, aunque si hubiera predicho BRA sí.
  it('bracket rígido: predecir un equipo eliminado da 0, predecir el real da los puntos', () => {
    const cuartos = (winner: string) =>
      scoreKnockoutMatch(winner, {
        phase: 'cuartos',
        realWinnerTeamCode: 'BRA',
        cancelled: false,
      });

    expect(cuartos('ESP')).toEqual({ points: 0, hit: false });
    expect(cuartos('BRA')).toEqual({ points: 10, hit: true });
  });

  it('el máximo por cruce es 25 (final)', () => {
    expect(
      scoreKnockoutMatch('ARG', {
        phase: 'final',
        realWinnerTeamCode: 'ARG',
        cancelled: false,
      }).points,
    ).toBe(25);
  });
});
