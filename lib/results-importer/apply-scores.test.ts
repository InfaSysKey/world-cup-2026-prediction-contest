import { describe, expect, it } from 'vitest';

import { computeScoreUpdate, type DbMatchSubset } from './apply-scores';
import type { OpenfootballMatch } from './openfootball-schema';

function entry(o: Partial<OpenfootballMatch> = {}): OpenfootballMatch {
  return {
    round: 'Matchday 1',
    date: '2026-06-11',
    team1: 'Mexico',
    team2: 'South Africa',
    ...o,
  };
}

const GROUP_MATCH: DbMatchSubset = {
  phase: 'grupos',
  homeTeamCode: 'MEX',
  awayTeamCode: 'ZAF',
};

const KNOCKOUT_MATCH: DbMatchSubset = {
  phase: '1/16',
  homeTeamCode: 'ESP',
  awayTeamCode: 'PRT',
};

describe('computeScoreUpdate — fase de grupos', () => {
  it('victoria local → winner = home', () => {
    const r = computeScoreUpdate(
      entry({ score: { ft: [2, 0] } }),
      GROUP_MATCH,
      'MEX',
      'ZAF',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 2, golesVisitante: 0, winnerTeamCode: 'MEX' },
    });
  });

  it('victoria visitante → winner = away', () => {
    const r = computeScoreUpdate(
      entry({ score: { ft: [0, 3] } }),
      GROUP_MATCH,
      'MEX',
      'ZAF',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 0, golesVisitante: 3, winnerTeamCode: 'ZAF' },
    });
  });

  it('empate en grupos → winner = null', () => {
    const r = computeScoreUpdate(
      entry({ score: { ft: [1, 1] } }),
      GROUP_MATCH,
      'MEX',
      'ZAF',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 1, golesVisitante: 1, winnerTeamCode: null },
    });
  });

  it('si openfootball trae team1/team2 invertidos respecto a BD, alinea los goles', () => {
    // openfootball: ZAF vs MEX, ft=[3,0] → en BD (MEX vs ZAF) es (0,3) → ZAF gana.
    const r = computeScoreUpdate(
      entry({ team1: 'South Africa', team2: 'Mexico', score: { ft: [3, 0] } }),
      GROUP_MATCH,
      'ZAF',
      'MEX',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 0, golesVisitante: 3, winnerTeamCode: 'ZAF' },
    });
  });

  it('sin score → no-score', () => {
    const r = computeScoreUpdate(entry({}), GROUP_MATCH, 'MEX', 'ZAF');
    expect(r).toEqual({ kind: 'no-score' });
  });
});

describe('computeScoreUpdate — knockouts', () => {
  it('decidido en 90, sin prórroga → usa ft, winner por goles', () => {
    const r = computeScoreUpdate(
      entry({ round: 'Round of 32', team1: 'Spain', team2: 'Portugal', score: { ft: [2, 1] } }),
      KNOCKOUT_MATCH,
      'ESP',
      'PRT',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 2, golesVisitante: 1, winnerTeamCode: 'ESP' },
    });
  });

  it('decidido en prórroga → usa et, winner por goles', () => {
    const r = computeScoreUpdate(
      entry({
        round: 'Round of 32',
        team1: 'Spain',
        team2: 'Portugal',
        score: { ft: [1, 1], et: [2, 1] },
      }),
      KNOCKOUT_MATCH,
      'ESP',
      'PRT',
    );
    expect(r.kind).toBe('applied');
    if (r.kind === 'applied') {
      expect(r.update.golesLocal).toBe(2);
      expect(r.update.golesVisitante).toBe(1);
      expect(r.update.winnerTeamCode).toBe('ESP');
    }
  });

  it('empate al 120 + penaltis → marcador al 120 + winner por p', () => {
    const r = computeScoreUpdate(
      entry({
        round: 'Round of 32',
        team1: 'Spain',
        team2: 'Portugal',
        score: { ft: [1, 1], et: [2, 2], p: [4, 3] },
      }),
      KNOCKOUT_MATCH,
      'ESP',
      'PRT',
    );
    expect(r).toEqual({
      kind: 'applied',
      update: { golesLocal: 2, golesVisitante: 2, winnerTeamCode: 'ESP' },
    });
  });

  it('empate al 120 sin penaltis disponibles → skipped (admin a mano)', () => {
    const r = computeScoreUpdate(
      entry({
        round: 'Round of 32',
        team1: 'Spain',
        team2: 'Portugal',
        score: { ft: [1, 1], et: [2, 2] },
      }),
      KNOCKOUT_MATCH,
      'ESP',
      'PRT',
    );
    expect(r.kind).toBe('skipped');
    if (r.kind === 'skipped') {
      expect(r.reason).toBe('KNOCKOUT_TIE_NO_PENALTIES');
    }
  });
});
