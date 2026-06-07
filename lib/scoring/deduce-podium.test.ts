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
