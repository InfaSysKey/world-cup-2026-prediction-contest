import { describe, expect, it } from 'vitest';

import { deducePodium, hasAnyDeduction, type KnockoutPick } from './deduce-podium';

// Bracket completo y coherente: 2 semis (ESP, FRA), final la gana ESP, 3-4 la
// gana POR. → campeón ESP, subcampeón FRA, tercero POR.
const FULL: KnockoutPick[] = [
  { phase: 'semi', winnerTeamCode: 'ESP' },
  { phase: 'semi', winnerTeamCode: 'FRA' },
  { phase: 'final', winnerTeamCode: 'ESP' },
  { phase: '3-4', winnerTeamCode: 'POR' },
];

describe('deducePodium', () => {
  it('deduce los 3 puestos de un bracket completo', () => {
    expect(deducePodium(FULL)).toEqual({
      champion: 'ESP',
      runnerUp: 'FRA',
      third: 'POR',
    });
  });

  it('sin ninguna predicción de bracket devuelve los 3 a null', () => {
    expect(deducePodium([])).toEqual({
      champion: null,
      runnerUp: null,
      third: null,
    });
  });

  it('con final pero sin 3-4 deduce campeón y subcampeón, tercero null', () => {
    const picks: KnockoutPick[] = [
      { phase: 'semi', winnerTeamCode: 'ESP' },
      { phase: 'semi', winnerTeamCode: 'FRA' },
      { phase: 'final', winnerTeamCode: 'ESP' },
    ];
    expect(deducePodium(picks)).toEqual({
      champion: 'ESP',
      runnerUp: 'FRA',
      third: null,
    });
  });

  it('no deduce subcampeón si falta una de las dos semis', () => {
    const picks: KnockoutPick[] = [
      { phase: 'semi', winnerTeamCode: 'ESP' },
      { phase: 'final', winnerTeamCode: 'ESP' },
    ];
    expect(deducePodium(picks).runnerUp).toBeNull();
  });

  it('no deduce subcampeón si el campeón no es uno de los finalistas (bracket incoherente)', () => {
    const picks: KnockoutPick[] = [
      { phase: 'semi', winnerTeamCode: 'ESP' },
      { phase: 'semi', winnerTeamCode: 'FRA' },
      { phase: 'final', winnerTeamCode: 'BRA' },
    ];
    expect(deducePodium(picks).runnerUp).toBeNull();
  });

  it('deduce solo el tercero si solo está predicho el 3-4', () => {
    const picks: KnockoutPick[] = [{ phase: '3-4', winnerTeamCode: 'POR' }];
    expect(deducePodium(picks)).toEqual({
      champion: null,
      runnerUp: null,
      third: 'POR',
    });
  });

  it('solo final sin semis → solo champion, runnerUp null, third null', () => {
    // El usuario predijo el ganador de la final pero no las semis.
    // No se puede deducir subcampeón (no sabemos quiénes eran los finalistas).
    const picks: KnockoutPick[] = [{ phase: 'final', winnerTeamCode: 'BRA' }];
    expect(deducePodium(picks)).toEqual({
      champion: 'BRA',
      runnerUp: null,
      third: null,
    });
  });

  it('bracket incoherente (campeón no es ganador de ninguna semi) → champion se prefilla igualmente, runnerUp null', () => {
    // Documenta el comportamiento real: deducePodium NO valida coherencia
    // entre fases. El campeón se deduce del partido 'final' sin comprobaciones
    // adicionales. runnerUp queda null porque el champion (BRA) no figura entre
    // los winners de semi (ESP, FRA) — véase la condición
    //   semiWinners.includes(champion)
    // en deduce-podium.ts.
    // scoring-rules.md §2.6 no prohíbe este input; el formulario de bracket
    // permite al usuario elegir libremente (el bracket es rígido, sin recolocación).
    const picks: KnockoutPick[] = [
      { phase: 'semi', winnerTeamCode: 'ESP' },
      { phase: 'semi', winnerTeamCode: 'FRA' },
      { phase: 'final', winnerTeamCode: 'BRA' }, // no es ninguna de las dos semis
    ];
    const result = deducePodium(picks);
    expect(result.champion).toBe('BRA');  // se prefilla igual
    expect(result.runnerUp).toBeNull();   // no se puede deducir
    expect(result.third).toBeNull();
  });
});

describe('hasAnyDeduction', () => {
  it('es false cuando todo es null', () => {
    expect(
      hasAnyDeduction({ champion: null, runnerUp: null, third: null }),
    ).toBe(false);
  });

  it('es true en cuanto hay un puesto deducido', () => {
    expect(
      hasAnyDeduction({ champion: null, runnerUp: null, third: 'POR' }),
    ).toBe(true);
  });
});
