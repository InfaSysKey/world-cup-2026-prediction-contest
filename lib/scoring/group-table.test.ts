import { describe, expect, it } from 'vitest';

import {
  computeGroupPoints,
  findTiedBlocks,
  type GroupMatchScoreInput,
} from './group-table';

const TEAMS = ['AAA', 'BBB', 'CCC', 'DDD'];

// Los 6 partidos de un grupo de 4 (todos contra todos).
function pairings(
  scores: Array<[string, string, number | null, number | null]>,
): GroupMatchScoreInput[] {
  return scores.map(([homeCode, awayCode, golesLocal, golesVisitante]) => ({
    homeCode,
    awayCode,
    golesLocal,
    golesVisitante,
  }));
}

describe('computeGroupPoints', () => {
  it('reparte 3/1/0 y deja un ganador claro sin empates', () => {
    // AAA gana todo (9), BBB gana 2 (6), CCC gana 1 (3), DDD pierde todo (0).
    const matches = pairings([
      ['AAA', 'BBB', 1, 0],
      ['AAA', 'CCC', 1, 0],
      ['AAA', 'DDD', 1, 0],
      ['BBB', 'CCC', 1, 0],
      ['BBB', 'DDD', 1, 0],
      ['CCC', 'DDD', 1, 0],
    ]);

    const points = computeGroupPoints(TEAMS, matches);

    expect(points).toEqual([
      { teamCode: 'AAA', points: 9 },
      { teamCode: 'BBB', points: 6 },
      { teamCode: 'CCC', points: 3 },
      { teamCode: 'DDD', points: 0 },
    ]);
    expect(findTiedBlocks(points)).toEqual([]);
  });

  it('detecta un empate a puntos entre dos equipos', () => {
    // AAA 9, DDD 0, BBB y CCC empatan a 3.
    const matches = pairings([
      ['AAA', 'BBB', 1, 0],
      ['AAA', 'CCC', 1, 0],
      ['AAA', 'DDD', 1, 0],
      ['BBB', 'CCC', 0, 0],
      ['BBB', 'DDD', 0, 1],
      ['CCC', 'DDD', 0, 1],
    ]);

    const points = computeGroupPoints(TEAMS, matches);
    const tied = findTiedBlocks(points);

    // DDD ganó 2 (BBB y CCC) → 6; BBB y CCC suman 1 cada uno por el empate mutuo.
    expect(points).toEqual([
      { teamCode: 'AAA', points: 9 },
      { teamCode: 'BBB', points: 1 },
      { teamCode: 'CCC', points: 1 },
      { teamCode: 'DDD', points: 6 },
    ]);
    expect(tied).toEqual([['BBB', 'CCC']]);
  });

  it('detecta un empate a puntos entre tres equipos', () => {
    // Triple empate clásico: AAA, BBB, CCC a 3; DDD pierde todo… ajustamos para
    // que tres equipos queden a 4.
    const matches = pairings([
      ['AAA', 'BBB', 1, 0], // AAA +3
      ['BBB', 'CCC', 1, 0], // BBB +3
      ['CCC', 'AAA', 1, 0], // CCC +3
      ['AAA', 'DDD', 1, 1], // AAA +1, DDD +1
      ['BBB', 'DDD', 1, 1], // BBB +1, DDD +1
      ['CCC', 'DDD', 1, 1], // CCC +1, DDD +1
    ]);

    const points = computeGroupPoints(TEAMS, matches);
    const tied = findTiedBlocks(points);

    expect(points).toEqual([
      { teamCode: 'AAA', points: 4 },
      { teamCode: 'BBB', points: 4 },
      { teamCode: 'CCC', points: 4 },
      { teamCode: 'DDD', points: 3 },
    ]);
    expect(tied).toEqual([['AAA', 'BBB', 'CCC']]);
  });

  it('ignora partidos incompletos: produce puntos parciales', () => {
    const matches = pairings([
      ['AAA', 'BBB', 2, 0], // cuenta
      ['CCC', 'DDD', null, null], // hueco: no cuenta
      ['AAA', 'CCC', 1, null], // hueco parcial: no cuenta
    ]);

    const points = computeGroupPoints(TEAMS, matches);

    expect(points).toEqual([
      { teamCode: 'AAA', points: 3 },
      { teamCode: 'BBB', points: 0 },
      { teamCode: 'CCC', points: 0 },
      { teamCode: 'DDD', points: 0 },
    ]);
    // Tres equipos a 0 → un bloque empatado (no fuerza desempate por sí solo;
    // la UI solo lo exige cuando el grupo está completo).
    expect(findTiedBlocks(points)).toEqual([['BBB', 'CCC', 'DDD']]);
  });
});
