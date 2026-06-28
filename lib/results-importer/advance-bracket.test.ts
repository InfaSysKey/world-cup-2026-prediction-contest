import { describe, expect, it } from 'vitest';

import {
  computeBracketUpdates,
  resolveSlotRef,
  type KnockoutMatch,
  type StandingsSource,
} from './advance-bracket';

// Combinación real del Mundial 2026: los mejores terceros vienen de los grupos
// B, D, E, F, I, J, K, L. La asignación a cruces sigue Annex C del reglamento
// FIFA (ver `best-thirds-allocation.ts`).
const STANDINGS: StandingsSource = {
  byGroupAndPosition: new Map([
    ['A|1', 'MEX'],
    ['A|2', 'ZAF'],
    ['B|1', 'CHE'],
    ['B|2', 'QAT'],
    ['D|1', 'USA'],
    ['E|1', 'DEU'],
    ['G|1', 'BEL'],
    ['I|1', 'FRA'],
    ['K|1', 'COL'],
    ['L|1', 'ENG'],
  ]),
  bestThirdsByPosition: new Map([
    [1, 'COD'], // K → cruce 80 (1L vs 3K)
    [2, 'SWE'], // F → cruce 77 (1I vs 3F)
    [3, 'ECU'], // E → cruce 79 (1A vs 3E)
    [4, 'GHA'], // L → cruce 87 (1K vs 3L)
    [5, 'BIH'], // B → cruce 81 (1D vs 3B)
    [6, 'DZA'], // J → cruce 85 (1B vs 3J)
    [7, 'PRY'], // D → cruce 74 (1E vs 3D)
    [8, 'SEN'], // I → cruce 82 (1G vs 3I)
  ]),
  teamGroupByCode: new Map([
    ['COD', 'K'],
    ['SWE', 'F'],
    ['ECU', 'E'],
    ['GHA', 'L'],
    ['BIH', 'B'],
    ['DZA', 'J'],
    ['PRY', 'D'],
    ['SEN', 'I'],
  ]),
};

const MATCH_73: KnockoutMatch = {
  id: 73,
  homeSlotRef: '2A',
  awaySlotRef: '2B',
  homeTeamCode: 'ZAF',
  awayTeamCode: 'QAT',
  realWinnerTeamCode: 'ZAF',
};

const MATCH_74: KnockoutMatch = {
  id: 74,
  homeSlotRef: '1E',
  awaySlotRef: '3ABCDF',
  homeTeamCode: null,
  awayTeamCode: null,
  realWinnerTeamCode: null,
};

const MATCHES_BY_ID = new Map<number, KnockoutMatch>([
  [73, MATCH_73],
  [74, MATCH_74],
]);

describe('resolveSlotRef', () => {
  it('resuelve 1X / 2X contra actualGroupStandings', () => {
    expect(resolveSlotRef('1A', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'MEX',
    });
    expect(resolveSlotRef('2B', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'QAT',
    });
  });

  it('resuelve 3XYZ... según Annex C (combinación Mundial 2026)', () => {
    // Annex C dice: slot 3ABCDF → grupo D → PRY.
    expect(resolveSlotRef('3ABCDF', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'PRY',
    });
    // Y los otros 7 slots de los cruces que enfrentan ganador vs tercero.
    expect(resolveSlotRef('3CDFGH', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'SWE',
    });
    expect(resolveSlotRef('3CEFHI', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'ECU',
    });
    expect(resolveSlotRef('3EHIJK', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'COD',
    });
    expect(resolveSlotRef('3BEFIJ', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'BIH',
    });
    expect(resolveSlotRef('3AEHIJ', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'SEN',
    });
    expect(resolveSlotRef('3EFGIJ', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'DZA',
    });
    expect(resolveSlotRef('3DEIJL', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'GHA',
    });
  });

  it('3XYZ pending mientras no haya 8 terceros confirmados', () => {
    const partial: StandingsSource = {
      ...STANDINGS,
      bestThirdsByPosition: new Map([
        [1, 'COD'],
        [2, 'SWE'],
        [3, 'ECU'],
      ]),
    };
    const r = resolveSlotRef('3ABCDF', MATCHES_BY_ID, partial);
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
      expect(r.reason).toBe('BEST_THIRD_NOT_AVAILABLE');
    }
  });

  it('3XYZ pending con combinación de 8 grupos no cubierta en Annex C', () => {
    // 8 terceros pero la combinación {A,B,C,D,E,F,G,H} no está hardcodeada.
    const otherCombo: StandingsSource = {
      ...STANDINGS,
      bestThirdsByPosition: new Map([
        [1, 'T1'],
        [2, 'T2'],
        [3, 'T3'],
        [4, 'T4'],
        [5, 'T5'],
        [6, 'T6'],
        [7, 'T7'],
        [8, 'T8'],
      ]),
      teamGroupByCode: new Map([
        ['T1', 'A'],
        ['T2', 'B'],
        ['T3', 'C'],
        ['T4', 'D'],
        ['T5', 'E'],
        ['T6', 'F'],
        ['T7', 'G'],
        ['T8', 'H'],
      ]),
    };
    const r = resolveSlotRef('3ABCDF', MATCHES_BY_ID, otherCombo);
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
      expect(r.reason).toBe('THIRDS_COMBINATION_UNKNOWN');
    }
  });

  it('pending si standing aún no cerrado', () => {
    const r = resolveSlotRef('1Z', MATCHES_BY_ID, {
      ...STANDINGS,
      byGroupAndPosition: new Map(),
    });
    // Z no es A..L → BAD_SLOT_FORMAT, no STANDING_NOT_AVAILABLE
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
      expect(r.reason).toBe('BAD_SLOT_FORMAT');
    }
  });

  it('resuelve WNN al ganador del match', () => {
    expect(resolveSlotRef('W73', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'ZAF',
    });
  });

  it('resuelve LNN al perdedor (no-ganador) del match', () => {
    expect(resolveSlotRef('L73', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'QAT',
    });
  });

  it('WNN pending si el match origen no está finished', () => {
    const pendingMatches = new Map<number, KnockoutMatch>([
      [
        90,
        {
          id: 90,
          homeSlotRef: null,
          awaySlotRef: null,
          homeTeamCode: null,
          awayTeamCode: null,
          realWinnerTeamCode: null,
        },
      ],
    ]);
    const r = resolveSlotRef('W90', pendingMatches, STANDINGS);
    expect(r.kind).toBe('pending');
    if (r.kind === 'pending') {
      expect(r.reason).toBe('PREVIOUS_MATCH_NOT_FINISHED');
    }
  });
});

describe('computeBracketUpdates', () => {
  it('omite updates si home/away en BD ya coinciden con la resolución', () => {
    const { updates } = computeBracketUpdates([MATCH_73], STANDINGS);
    expect(updates).toEqual([]);
  });

  it('emite update si la resolución difiere de lo que hay en BD', () => {
    const stale: KnockoutMatch = {
      ...MATCH_74,
      homeTeamCode: null,
      awayTeamCode: null,
    };
    const { updates } = computeBracketUpdates([stale], STANDINGS);
    expect(updates).toEqual([
      { matchId: 74, homeTeamCode: 'DEU', awayTeamCode: 'PRY' },
    ]);
  });

  it('reporta pending si home o away no resuelven', () => {
    const stale: KnockoutMatch = {
      ...MATCH_74,
      homeTeamCode: null,
      awayTeamCode: null,
    };
    const emptyStandings: StandingsSource = {
      byGroupAndPosition: new Map(),
      bestThirdsByPosition: new Map(),
      teamGroupByCode: new Map(),
    };
    const { updates, pending } = computeBracketUpdates([stale], emptyStandings);
    expect(updates).toEqual([]);
    expect(pending.length).toBe(2);
  });
});
