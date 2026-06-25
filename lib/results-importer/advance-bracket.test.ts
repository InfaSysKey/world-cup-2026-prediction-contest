import { describe, expect, it } from 'vitest';

import {
  computeBracketUpdates,
  resolveSlotRef,
  type KnockoutMatch,
  type StandingsSource,
} from './advance-bracket';

const STANDINGS: StandingsSource = {
  byGroupAndPosition: new Map([
    ['A|1', 'MEX'],
    ['A|2', 'ZAF'],
    ['B|1', 'CAN'],
    ['B|2', 'QAT'],
    ['E|1', 'DEU'],
  ]),
  bestThirdsByPosition: new Map([
    [1, 'ARG'], // grupo J
    [2, 'BRA'], // grupo C
    [3, 'ESP'], // grupo H
  ]),
  teamGroupByCode: new Map([
    ['ARG', 'J'],
    ['BRA', 'C'],
    ['ESP', 'H'],
  ]),
};

const MATCHES_BY_ID = new Map<number, KnockoutMatch>([
  [
    73,
    {
      id: 73,
      homeSlotRef: '2A',
      awaySlotRef: '2B',
      homeTeamCode: 'ZAF',
      awayTeamCode: 'QAT',
      realWinnerTeamCode: 'ZAF',
    },
  ],
  [
    74,
    {
      id: 74,
      homeSlotRef: '1E',
      awaySlotRef: '3ABCDF',
      homeTeamCode: null,
      awayTeamCode: null,
      realWinnerTeamCode: null,
    },
  ],
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

  it('resuelve 3XYZ... buscando best_third cuyo grupo esté en el set', () => {
    // BRA está en grupo C → "3ABCDF" lo contiene.
    expect(resolveSlotRef('3ABCDF', MATCHES_BY_ID, STANDINGS)).toEqual({
      kind: 'resolved',
      teamCode: 'BRA',
    });
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
    const pendingMatches = new Map([
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
    const { updates } = computeBracketUpdates([MATCHES_BY_ID.get(73)!], STANDINGS);
    expect(updates).toEqual([]);
  });

  it('emite update si la resolución difiere de lo que hay en BD', () => {
    const stale: KnockoutMatch = {
      ...MATCHES_BY_ID.get(74)!,
      homeTeamCode: null,
      awayTeamCode: null,
    };
    const { updates } = computeBracketUpdates([stale], STANDINGS);
    expect(updates).toEqual([
      { matchId: 74, homeTeamCode: 'DEU', awayTeamCode: 'BRA' },
    ]);
  });

  it('reporta pending si home o away no resuelven', () => {
    const stale: KnockoutMatch = {
      ...MATCHES_BY_ID.get(74)!,
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
