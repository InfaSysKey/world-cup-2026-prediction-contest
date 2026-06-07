import { describe, expect, it } from 'vitest';

import {
  bestThirdsBatchSchema,
  groupMatchPredictionSchema,
  groupMatchPredictionsBatchSchema,
  groupStandingPredictionSchema,
  groupStandingsBatchSchema,
} from './predictions';

describe('groupMatchPredictionSchema', () => {
  it('acepta un marcador válido', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 1,
      golesLocal: 2,
      golesVisitante: 1,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza goles negativos', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 1,
      golesLocal: -1,
      golesVisitante: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza matchId fuera de rango (knockout)', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 73,
      golesLocal: 1,
      golesVisitante: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza goles no enteros', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 5,
      golesLocal: 1.5,
      golesVisitante: 0,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un string en lugar de número (sin coerción)', () => {
    const r = groupMatchPredictionSchema.safeParse({
      matchId: 5,
      golesLocal: '2',
      golesVisitante: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe('groupMatchPredictionsBatchSchema', () => {
  it('acepta un array de marcadores válidos', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([
      { matchId: 1, golesLocal: 0, golesVisitante: 0 },
      { matchId: 2, golesLocal: 3, golesVisitante: 2 },
    ]);
    expect(r.success).toBe(true);
  });

  it('acepta un array vacío', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([]);
    expect(r.success).toBe(true);
  });

  it('rechaza si algún elemento es inválido', () => {
    const r = groupMatchPredictionsBatchSchema.safeParse([
      { matchId: 1, golesLocal: 0, golesVisitante: 0 },
      { matchId: 2, golesLocal: -1, golesVisitante: 2 },
    ]);
    expect(r.success).toBe(false);
  });
});

describe('groupStandingPredictionSchema', () => {
  it('acepta una posición válida', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 1,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una letra de grupo inexistente', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'Z',
      position: 1,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza posición fuera de rango', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 5,
      teamCode: 'MEX',
    });
    expect(r.success).toBe(false);
  });

  it('rechaza un code de equipo con formato inválido', () => {
    const r = groupStandingPredictionSchema.safeParse({
      groupLetter: 'A',
      position: 1,
      teamCode: 'mexico',
    });
    expect(r.success).toBe(false);
  });
});

describe('groupStandingsBatchSchema', () => {
  it('acepta un grupo completo y bien ordenado', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 2, teamCode: 'CAN' },
      { groupLetter: 'A', position: 3, teamCode: 'USA' },
      { groupLetter: 'A', position: 4, teamCode: 'RSA' },
    ]);
    expect(r.success).toBe(true);
  });

  it('rechaza una posición repetida dentro del mismo grupo', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 1, teamCode: 'CAN' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza el mismo equipo en dos posiciones del mismo grupo', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'A', position: 2, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('permite la misma posición en grupos distintos', () => {
    const r = groupStandingsBatchSchema.safeParse([
      { groupLetter: 'A', position: 1, teamCode: 'MEX' },
      { groupLetter: 'B', position: 1, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(true);
  });
});

describe('bestThirdsBatchSchema', () => {
  it('acepta un ranking parcial válido', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 2, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(true);
  });

  it('acepta un array vacío (guardado parcial)', () => {
    const r = bestThirdsBatchSchema.safeParse([]);
    expect(r.success).toBe(true);
  });

  it('rechaza posición fuera de 1–8', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 9, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza el mismo equipo en dos posiciones', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 2, teamCode: 'MEX' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza una posición repetida', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'MEX' },
      { position: 1, teamCode: 'ESP' },
    ]);
    expect(r.success).toBe(false);
  });

  it('rechaza más de 8 selecciones', () => {
    const codes = ['MEX', 'ESP', 'BRA', 'ARG', 'FRA', 'GER', 'ITA', 'POR', 'NED'];
    const r = bestThirdsBatchSchema.safeParse(
      codes.map((teamCode, i) => ({ position: i + 1, teamCode })),
    );
    expect(r.success).toBe(false);
  });

  it('rechaza un teamCode con formato inválido', () => {
    const r = bestThirdsBatchSchema.safeParse([
      { position: 1, teamCode: 'mexico' },
    ]);
    expect(r.success).toBe(false);
  });
});
