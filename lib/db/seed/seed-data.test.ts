import { describe, expect, it } from 'vitest';

import {
  GROUP_LETTERS,
  MATCHES_GROUP_STAGE,
  MATCHES_KNOCKOUT,
  MATCHES_TOTAL,
  TEAMS_COUNT,
} from '../../constants';
import { MATCHES } from './matches';
import { TEAMS } from './teams';

describe('datos de seed: teams', () => {
  it(`tiene ${TEAMS_COUNT} equipos con códigos únicos`, () => {
    expect(TEAMS).toHaveLength(TEAMS_COUNT);
    expect(new Set(TEAMS.map((t) => t.code)).size).toBe(TEAMS_COUNT);
  });

  it('reparte 4 equipos en cada uno de los 12 grupos', () => {
    for (const letter of GROUP_LETTERS) {
      expect(TEAMS.filter((t) => t.groupLetter === letter)).toHaveLength(4);
    }
  });
});

describe('datos de seed: matches', () => {
  it(`tiene ${MATCHES_TOTAL} partidos con ids 1..${MATCHES_TOTAL}`, () => {
    expect(MATCHES).toHaveLength(MATCHES_TOTAL);
    expect(MATCHES.map((m) => m.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: MATCHES_TOTAL }, (_, i) => i + 1),
    );
  });

  it(`tiene ${MATCHES_GROUP_STAGE} de grupos y ${MATCHES_KNOCKOUT} de eliminatorias`, () => {
    const grupos = MATCHES.filter((m) => m.phase === 'grupos');
    const knockout = MATCHES.filter((m) => m.phase !== 'grupos');
    expect(grupos).toHaveLength(MATCHES_GROUP_STAGE);
    expect(knockout).toHaveLength(MATCHES_KNOCKOUT);
  });

  it('los partidos de grupos llevan equipos resueltos y los de eliminatorias slot-refs', () => {
    for (const m of MATCHES) {
      if (m.phase === 'grupos') {
        expect(m.homeTeamCode).toBeTruthy();
        expect(m.awayTeamCode).toBeTruthy();
      } else {
        expect(m.homeSlotRef).toBeTruthy();
        expect(m.awaySlotRef).toBeTruthy();
        expect(m.homeTeamCode ?? null).toBeNull();
      }
    }
  });
});
