import { describe, expect, it } from 'vitest';

import {
  TEAM_ADVANCEMENT_PHASES,
  scoreTeamAdvancement,
  type TeamAdvancementInputs,
} from './team-advancement';

// Puntuación de "Equipos clasificados por fase" (scoring-rules.md §3.4, v2.0).
// Función PURA: 2 pts × intersección entre los equipos predichos y los reales en
// cada una de las 6 fases. Total máximo = 32+16+8+4+2+2 = 64 aciertos × 2 = 128.

// Construye un input con una fase configurada y el resto vacías (actual: null).
function only(
  phase: (typeof TEAM_ADVANCEMENT_PHASES)[number],
  predicted: readonly string[],
  actual: readonly string[] | null,
): TeamAdvancementInputs {
  const baseP: TeamAdvancementInputs['predicted'] = {
    '1/16': [],
    '1/8': [],
    cuartos: [],
    semi: [],
    '3-4': [],
    final: [],
  };
  const baseA: TeamAdvancementInputs['actual'] = {
    '1/16': null,
    '1/8': null,
    cuartos: null,
    semi: null,
    '3-4': null,
    final: null,
  };
  return {
    predicted: { ...baseP, [phase]: predicted },
    actual: { ...baseA, [phase]: actual },
  };
}

describe('scoreTeamAdvancement (§3.4)', () => {
  it('todas las fases vacías → 0 pts y desglose con hits=0/points=0 por fase', () => {
    const s = scoreTeamAdvancement(only('1/16', [], null));
    expect(s.points).toBe(0);
    expect(s.byPhase).toHaveLength(6);
    for (const entry of s.byPhase) {
      expect(entry.hits).toBe(0);
      expect(entry.points).toBe(0);
    }
  });

  it('una fase con actual=null (sin cerrar) no puntúa aunque la predicción esté completa', () => {
    const s = scoreTeamAdvancement(only('cuartos', ['ESP', 'FRA'], null));
    expect(s.points).toBe(0);
    const cuartos = s.byPhase.find((p) => p.phase === 'cuartos');
    expect(cuartos).toEqual({ phase: 'cuartos', hits: 0, points: 0 });
  });

  // ADR 0013: la categoría se evalúa por-equipo. El orquestador pasa el conjunto
  // de equipos confirmados hasta ahora — si está incompleto, se cuenta lo que
  // YA esté confirmado y los que aún no se sabe no penalizan.
  it('actual parcial (1/16 con 12 de 32) puntúa los aciertos confirmados sin penalizar el resto', () => {
    const s = scoreTeamAdvancement(
      only(
        '1/16',
        ['ESP', 'BRA', 'ARG', 'POR'],
        ['ESP', 'FRA', 'BRA', 'NED', 'GER', 'ITA', 'BEL', 'URU', 'KOR', 'JPN', 'AUS', 'MEX'],
      ),
    );
    const oct = s.byPhase.find((p) => p.phase === '1/16');
    expect(oct).toEqual({ phase: '1/16', hits: 2, points: 4 });
    expect(s.points).toBe(4);
  });

  it('intersección de 2 equipos en semi → 2 hits × 2 pts = 4', () => {
    const s = scoreTeamAdvancement(
      only('semi', ['ESP', 'FRA'], ['ESP', 'FRA', 'BRA', 'ARG']),
    );
    const semi = s.byPhase.find((p) => p.phase === 'semi');
    expect(semi).toEqual({ phase: 'semi', hits: 2, points: 4 });
    expect(s.points).toBe(4);
  });

  // ADR 0003 (bracket rígido) aplicado a team_advancement: si el equipo predicho
  // como ganador de un cruce ya cayó en una ronda previa, su nombre no aparece
  // en `actual` de las fases siguientes → 0 hits, 0 pts. Sin rebracket.
  it('bracket rígido: predijo a ESP en 1/8 pero ESP cayó en 1/16 → 0 hits, 0 pts', () => {
    const s = scoreTeamAdvancement(
      only('1/8', ['ESP'], ['FRA', 'ARG', 'BRA', 'ENG', 'POR', 'GER', 'NED', 'ITA']),
    );
    const octavos = s.byPhase.find((p) => p.phase === '1/8');
    expect(octavos).toEqual({ phase: '1/8', hits: 0, points: 0 });
    expect(s.points).toBe(0);
  });

  it('predicción con duplicados solo cuenta cada equipo una vez', () => {
    const s = scoreTeamAdvancement(
      only('cuartos', ['ESP', 'ESP', 'FRA'], ['ESP', 'FRA', 'BRA', 'ARG']),
    );
    const cuartos = s.byPhase.find((p) => p.phase === 'cuartos');
    expect(cuartos).toEqual({ phase: 'cuartos', hits: 2, points: 4 });
  });

  it('el desglose sale en el orden canónico de fases del Excel', () => {
    const s = scoreTeamAdvancement(only('1/16', [], null));
    expect(s.byPhase.map((p) => p.phase)).toEqual([
      '1/16',
      '1/8',
      'cuartos',
      'semi',
      '3-4',
      'final',
    ]);
  });

  it('máximo absoluto: aciertos completos en todas las fases → 32+16+8+4+2+2 = 64 × 2 = 128 pts', () => {
    const teams = (n: number) =>
      Array.from({ length: n }, (_, i) => `T${i + 1}`);
    const all32 = teams(32);
    const all16 = teams(16);
    const all8 = teams(8);
    const all4 = teams(4);
    const all2 = teams(2);
    const inputs: TeamAdvancementInputs = {
      predicted: {
        '1/16': all32,
        '1/8': all16,
        cuartos: all8,
        semi: all4,
        '3-4': all2,
        final: all2,
      },
      actual: {
        '1/16': all32,
        '1/8': all16,
        cuartos: all8,
        semi: all4,
        '3-4': all2,
        final: all2,
      },
    };
    const s = scoreTeamAdvancement(inputs);
    expect(s.points).toBe(128);
    expect(s.byPhase.map((p) => p.hits)).toEqual([32, 16, 8, 4, 2, 2]);
  });
});
