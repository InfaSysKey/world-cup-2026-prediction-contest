import { describe, expect, it } from 'vitest';

import {
  premiosCompletion,
  premiosStateFromAwards,
  type PremiosState,
} from './premios-completion';

describe('premiosStateFromAwards', () => {
  it('proyecta los kinds boot_*/ball_* e ignora los del podio', () => {
    const state = premiosStateFromAwards([
      { kind: 'boot_gold', playerName: 'Kane' },
      { kind: 'ball_silver', playerName: 'Bellingham' },
      { kind: 'champion', playerName: null }, // kind de podio → se ignora
    ]);
    expect(state.bootGold).toBe('Kane');
    expect(state.ballSilver).toBe('Bellingham');
    expect(state.bootSilver).toBeNull();
  });

  it('devuelve todo null sin premios', () => {
    const state = premiosStateFromAwards([]);
    expect(Object.values(state).every((v) => v === null)).toBe(true);
  });
});

describe('premiosCompletion', () => {
  const FULL: PremiosState = {
    bootGold: 'A',
    bootSilver: 'B',
    bootBronze: 'C',
    ballGold: 'D',
    ballSilver: 'E',
    ballBronze: 'F',
  };
  const EMPTY: PremiosState = {
    bootGold: null,
    bootSilver: null,
    bootBronze: null,
    ballGold: null,
    ballSilver: null,
    ballBronze: null,
  };

  it('complete con los 6 rellenos', () => {
    expect(premiosCompletion(FULL)).toBe('complete');
  });

  it('partial con alguno pero no los 6', () => {
    expect(premiosCompletion({ ...EMPTY, bootGold: 'A' })).toBe('partial');
  });

  it('empty sin ninguno', () => {
    expect(premiosCompletion(EMPTY)).toBe('empty');
  });
});
