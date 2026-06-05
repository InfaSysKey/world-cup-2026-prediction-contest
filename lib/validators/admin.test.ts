import { describe, expect, it } from 'vitest';

import {
  actualAwardSchema,
  bestThirdsSchema,
  groupStandingSchema,
  matchResultSchema,
} from './admin';

describe('matchResultSchema', () => {
  const grupos = {
    matchId: '1',
    isKnockout: 'false',
    golesLocal: '2',
    golesVisitante: '0',
  };

  it('acepta un marcador de grupos sin ganador explícito', () => {
    expect(matchResultSchema.safeParse(grupos).success).toBe(true);
  });

  it('rechaza goles negativos', () => {
    expect(
      matchResultSchema.safeParse({ ...grupos, golesLocal: '-1' }).success,
    ).toBe(false);
  });

  it('rechaza un knockout sin ganador', () => {
    expect(
      matchResultSchema.safeParse({ ...grupos, isKnockout: 'true' }).success,
    ).toBe(false);
  });

  it('acepta un knockout con ganador', () => {
    const result = matchResultSchema.safeParse({
      ...grupos,
      isKnockout: 'true',
      winnerTeamCode: 'MEX',
    });
    expect(result.success).toBe(true);
  });
});

describe('groupStandingSchema', () => {
  it('acepta 4 equipos distintos en orden', () => {
    expect(
      groupStandingSchema.safeParse({
        groupLetter: 'A',
        teamCodes: ['MEX', 'KOR', 'CZE', 'ZAF'],
      }).success,
    ).toBe(true);
  });

  it('rechaza equipos repetidos', () => {
    expect(
      groupStandingSchema.safeParse({
        groupLetter: 'A',
        teamCodes: ['MEX', 'MEX', 'CZE', 'ZAF'],
      }).success,
    ).toBe(false);
  });

  it('rechaza un grupo inexistente', () => {
    expect(
      groupStandingSchema.safeParse({
        groupLetter: 'Z',
        teamCodes: ['MEX', 'KOR', 'CZE', 'ZAF'],
      }).success,
    ).toBe(false);
  });
});

describe('bestThirdsSchema', () => {
  const eight = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8'];

  it('acepta 8 equipos distintos', () => {
    expect(bestThirdsSchema.safeParse({ teamCodes: eight }).success).toBe(true);
  });

  it('rechaza un número distinto de 8', () => {
    expect(
      bestThirdsSchema.safeParse({ teamCodes: eight.slice(0, 7) }).success,
    ).toBe(false);
  });

  it('rechaza equipos repetidos', () => {
    expect(
      bestThirdsSchema.safeParse({ teamCodes: [...eight.slice(0, 7), 'A1'] })
        .success,
    ).toBe(false);
  });
});

describe('actualAwardSchema', () => {
  it('acepta podio por equipo', () => {
    expect(
      actualAwardSchema.safeParse({ kind: 'champion', teamCode: 'ESP' }).success,
    ).toBe(true);
  });

  it('rechaza podio con jugador en vez de equipo', () => {
    expect(
      actualAwardSchema.safeParse({ kind: 'champion', playerName: 'Fulano' })
        .success,
    ).toBe(false);
  });

  it('acepta bota por jugador', () => {
    expect(
      actualAwardSchema.safeParse({ kind: 'boot_gold', playerName: 'Fulano' })
        .success,
    ).toBe(true);
  });

  it('rechaza bota con equipo en vez de jugador', () => {
    expect(
      actualAwardSchema.safeParse({ kind: 'boot_gold', teamCode: 'ESP' }).success,
    ).toBe(false);
  });
});
