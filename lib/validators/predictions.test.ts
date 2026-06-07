import { describe, expect, it } from 'vitest';

import {
  groupMatchPredictionSchema,
  groupMatchPredictionsBatchSchema,
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
