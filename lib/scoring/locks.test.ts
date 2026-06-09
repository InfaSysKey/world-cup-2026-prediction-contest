import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isGlobalPredictionLocked,
  isGroupMatchPredictionLocked,
  loadAllLocks,
} from './locks';

const START = '2026-06-11T17:00:00Z';

describe('locks', () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.TOURNAMENT_START_AT;
    process.env.TOURNAMENT_START_AT = START;
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.TOURNAMENT_START_AT;
    } else {
      process.env.TOURNAMENT_START_AT = prev;
    }
  });

  it('abierto antes del pitido inicial', () => {
    const now = new Date('2026-06-11T16:59:59Z');
    expect(isGlobalPredictionLocked(now)).toBe(false);
  });

  it('bloqueado justo en el pitido inicial', () => {
    const now = new Date(START);
    expect(isGlobalPredictionLocked(now)).toBe(true);
  });

  it('bloqueado después del pitido inicial', () => {
    const now = new Date('2026-06-12T00:00:00Z');
    expect(isGlobalPredictionLocked(now)).toBe(true);
  });

  it('las categorías delegan en el lock global (MVP)', () => {
    const open = new Date('2026-06-01T00:00:00Z');
    const closed = new Date('2026-07-01T00:00:00Z');
    expect(isGroupMatchPredictionLocked(open)).toBe(false);
    expect(isGroupMatchPredictionLocked(closed)).toBe(true);
  });

  it('loadAllLocks devuelve el mismo estado para todas las categorías', () => {
    const closed = new Date('2026-07-01T00:00:00Z');
    expect(loadAllLocks(closed)).toEqual({
      groupMatches: true,
      groupStandings: true,
      bestThirds: true,
      knockout: true,
      awards: true,
    });
  });
});
