import { describe, expect, it } from 'vitest';

import { computeGroupWinner } from './compute-winner';

describe('computeGroupWinner', () => {
  it('devuelve el local cuando marca más goles', () => {
    expect(computeGroupWinner('MEX', 'ZAF', 2, 0)).toBe('MEX');
  });

  it('devuelve el visitante cuando marca más goles', () => {
    expect(computeGroupWinner('MEX', 'ZAF', 1, 3)).toBe('ZAF');
  });

  it('devuelve null en caso de empate', () => {
    expect(computeGroupWinner('MEX', 'ZAF', 1, 1)).toBeNull();
  });
});
