import { describe, expect, it } from 'vitest';

import {
  findMatchForEntry,
  indexMatchesByKey,
  type MatchRow,
} from './match-finder';
import type { OpenfootballMatch } from './openfootball-schema';

const MATCHES: MatchRow[] = [
  {
    id: 1,
    phase: 'grupos',
    homeTeamCode: 'MEX',
    awayTeamCode: 'ZAF',
  },
  {
    id: 73,
    phase: '1/16',
    homeTeamCode: 'ESP',
    awayTeamCode: 'PRT',
  },
  {
    id: 74,
    phase: '1/16',
    // Bracket pendiente: este match knockout no tiene teams asignados.
    homeTeamCode: null,
    awayTeamCode: null,
  },
];

function entry(o: Partial<OpenfootballMatch>): OpenfootballMatch {
  return {
    round: 'Matchday 1',
    date: '2026-06-11',
    team1: 'Mexico',
    team2: 'South Africa',
    ...o,
  };
}

describe('findMatchForEntry', () => {
  const index = indexMatchesByKey(MATCHES);

  it('matchea un partido de grupos por (phase, home, away)', () => {
    const r = findMatchForEntry(entry({}), index);
    expect(r).toEqual({ kind: 'matched', matchId: 1 });
  });

  it('matchea también si openfootball trae home/away invertidos respecto al seed', () => {
    const r = findMatchForEntry(
      entry({ team1: 'South Africa', team2: 'Mexico' }),
      index,
    );
    expect(r).toEqual({ kind: 'matched', matchId: 1 });
  });

  it('matchea knockouts ya resueltos', () => {
    const r = findMatchForEntry(
      entry({ round: 'Round of 32', team1: 'Spain', team2: 'Portugal' }),
      index,
    );
    expect(r).toEqual({ kind: 'matched', matchId: 73 });
  });

  it('skipea knockouts cuyo bracket todavía no se ha resuelto', () => {
    const r = findMatchForEntry(
      entry({ round: 'Round of 32', team1: 'France', team2: 'Germany' }),
      index,
    );
    expect(r).toEqual({ kind: 'skipped', reason: 'BRACKET_PENDING' });
  });

  it('skipea con UNKNOWN_ROUND si el round no se reconoce', () => {
    const r = findMatchForEntry(entry({ round: 'Friendly' }), index);
    expect(r.kind).toBe('skipped');
    if (r.kind === 'skipped') {
      expect(r.reason).toBe('UNKNOWN_ROUND');
    }
  });

  it('skipea con UNKNOWN_TEAM_NAME si un nombre no está en el mapa', () => {
    const r = findMatchForEntry(entry({ team1: 'Atlantis' }), index);
    expect(r.kind).toBe('skipped');
    if (r.kind === 'skipped') {
      expect(r.reason).toBe('UNKNOWN_TEAM_NAME');
    }
  });

  it('indexMatchesByKey omite matches con teams null', () => {
    const idx = indexMatchesByKey(MATCHES);
    expect(idx.size).toBe(2);
  });
});
