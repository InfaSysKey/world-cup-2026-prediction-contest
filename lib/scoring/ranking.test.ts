import { describe, expect, it } from 'vitest';

import {
  extractRankingMetrics,
  rankPlayers,
  type RankingMetrics,
  type RankingPlayer,
} from './ranking';

// Ranking general y desempates (scoring-rules.md §7). Funciones PURAS: entran las
// métricas agregadas de cada jugador, sale el orden con su rango. El criterio 8
// (sorteo público) NO se aleatoriza aquí: los empates genuinos quedan con el
// mismo rango y `needsDraw=true` para que el admin los resuelva con random.org.
//
// Los esperados se calculan A MANO leyendo §7, nunca derivados de la función.

// Métricas base (todo a cero / false); cada test sobreescribe solo lo relevante.
function metrics(partial: Partial<RankingMetrics> = {}): RankingMetrics {
  return {
    totalPoints: 0,
    exactGroupMatches: 0,
    bracketHits: 0,
    championHit: false,
    runnerUpHit: false,
    thirdHit: false,
    exactGroups: 0,
    awardHits: 0,
    ...partial,
  };
}

function player(
  userId: number,
  nickname: string,
  partial: Partial<RankingMetrics> = {},
): RankingPlayer {
  return { userId, nickname, metrics: metrics(partial) };
}

// Atajo: nicknames en orden del ranking resultante.
function order(players: readonly RankingPlayer[]): string[] {
  return rankPlayers(players).map((p) => p.nickname);
}

describe('rankPlayers — orden base por puntos totales (§7)', () => {
  it('ordena por puntos totales descendente', () => {
    const players = [
      player(1, 'ana', { totalPoints: 60 }),
      player(2, 'ben', { totalPoints: 100 }),
      player(3, 'cas', { totalPoints: 80 }),
    ];
    expect(order(players)).toEqual(['ben', 'cas', 'ana']);
  });

  it('asigna rangos 1,2,3 sin empates y needsDraw=false', () => {
    const ranked = rankPlayers([
      player(1, 'ana', { totalPoints: 60 }),
      player(2, 'ben', { totalPoints: 100 }),
      player(3, 'cas', { totalPoints: 80 }),
    ]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3]);
    expect(ranked.every((p) => !p.needsDraw)).toBe(true);
  });

  it('el orden no depende del orden de entrada', () => {
    const a = player(1, 'ana', { totalPoints: 100 });
    const b = player(2, 'ben', { totalPoints: 80 });
    const c = player(3, 'cas', { totalPoints: 60 });
    expect(order([a, b, c])).toEqual(order([c, a, b]));
  });
});

describe('rankPlayers — los 8 criterios de desempate en orden (§7)', () => {
  it('§7.1: empate a puntos → más marcadores exactos de grupos gana', () => {
    const players = [
      player(1, 'ana', { totalPoints: 100, exactGroupMatches: 5 }),
      player(2, 'ben', { totalPoints: 100, exactGroupMatches: 9 }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.2: igualados hasta §7.1 → más cruces de bracket acertados gana', () => {
    const players = [
      player(1, 'ana', {
        totalPoints: 100,
        exactGroupMatches: 7,
        bracketHits: 4,
      }),
      player(2, 'ben', {
        totalPoints: 100,
        exactGroupMatches: 7,
        bracketHits: 9,
      }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.3: igualados hasta §7.2 → haber acertado el campeón gana', () => {
    const base = { totalPoints: 100, exactGroupMatches: 7, bracketHits: 5 };
    const players = [
      player(1, 'ana', { ...base, championHit: false }),
      player(2, 'ben', { ...base, championHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.4: igualados hasta §7.3 → haber acertado el subcampeón gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
    };
    const players = [
      player(1, 'ana', { ...base, runnerUpHit: false }),
      player(2, 'ben', { ...base, runnerUpHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.5: igualados hasta §7.4 → haber acertado el 3.º puesto gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
      runnerUpHit: true,
    };
    const players = [
      player(1, 'ana', { ...base, thirdHit: false }),
      player(2, 'ben', { ...base, thirdHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.6: igualados hasta §7.5 → más grupos clavados en orden gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
    };
    const players = [
      player(1, 'ana', { ...base, exactGroups: 2 }),
      player(2, 'ben', { ...base, exactGroups: 4 }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.7: igualados hasta §7.6 → más premios individuales acertados gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
      exactGroups: 3,
    };
    const players = [
      player(1, 'ana', { ...base, awardHits: 1 }),
      player(2, 'ben', { ...base, awardHits: 4 }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('un criterio temprano manda sobre los posteriores (no se suman)', () => {
    // ana gana en §7.1 aunque ben le supere en todos los criterios siguientes.
    const players = [
      player(1, 'ana', { totalPoints: 100, exactGroupMatches: 9 }),
      player(2, 'ben', {
        totalPoints: 100,
        exactGroupMatches: 8,
        bracketHits: 20,
        championHit: true,
        runnerUpHit: true,
        thirdHit: true,
        exactGroups: 12,
        awardHits: 6,
      }),
    ];
    expect(order(players)).toEqual(['ana', 'ben']);
  });
});

describe('rankPlayers — §7.8 sorteo: empate genuino', () => {
  it('dos jugadores idénticos en las 8 métricas → mismo rango y needsDraw', () => {
    const same = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
      exactGroups: 3,
      awardHits: 2,
    };
    const ranked = rankPlayers([
      player(1, 'ana', same),
      player(2, 'ben', same),
    ]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 1]);
    expect(ranked.every((p) => p.needsDraw)).toBe(true);
  });

  it('ranking de competición estándar: 1,2,2,4 con empate genuino en el medio', () => {
    const tied = {
      totalPoints: 80,
      exactGroupMatches: 5,
      bracketHits: 3,
      championHit: false,
      runnerUpHit: false,
      thirdHit: false,
      exactGroups: 1,
      awardHits: 0,
    };
    const ranked = rankPlayers([
      player(1, 'top', { totalPoints: 100 }),
      player(2, 'tieA', tied),
      player(3, 'tieB', tied),
      player(4, 'low', { totalPoints: 50 }),
    ]);
    const byNick = new Map(ranked.map((p) => [p.nickname, p]));
    expect(byNick.get('top')?.rank).toBe(1);
    expect(byNick.get('tieA')?.rank).toBe(2);
    expect(byNick.get('tieB')?.rank).toBe(2);
    expect(byNick.get('low')?.rank).toBe(4);
    expect(byNick.get('top')?.needsDraw).toBe(false);
    expect(byNick.get('tieA')?.needsDraw).toBe(true);
    expect(byNick.get('low')?.needsDraw).toBe(false);
  });

  it('entre empatados genuinos el orden es estable y determinista (por nickname)', () => {
    const same = { totalPoints: 100 };
    // Mismo conjunto, distinto orden de entrada → misma salida.
    const out1 = order([
      player(2, 'ben', same),
      player(1, 'ana', same),
    ]);
    const out2 = order([
      player(1, 'ana', same),
      player(2, 'ben', same),
    ]);
    expect(out1).toEqual(['ana', 'ben']);
    expect(out2).toEqual(['ana', 'ben']);
  });

  it('una diferencia mínima en el último criterio rompe el empate (sin needsDraw)', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      bracketHits: 5,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
      exactGroups: 3,
    };
    const ranked = rankPlayers([
      player(1, 'ana', { ...base, awardHits: 2 }),
      player(2, 'ben', { ...base, awardHits: 3 }),
    ]);
    expect(ranked.map((p) => p.nickname)).toEqual(['ben', 'ana']);
    expect(ranked.every((p) => !p.needsDraw)).toBe(true);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2]);
  });
});

describe('extractRankingMetrics — lee las métricas de §7 del desglose de scores', () => {
  // Filas tal como las produce compute.ts (detail jsonb por categoría).
  const rows = [
    {
      category: 'group_matches' as const,
      points: 120,
      detail: { reasons: { exact: 9, result: 4, one_goal: 2, wrong: 1 }, gaps: 0 },
    },
    {
      category: 'group_standings' as const,
      points: 40,
      detail: { exactGroups: 3, gaps: 0 },
    },
    {
      category: 'best_thirds' as const,
      points: 12,
      detail: { hits: 4, bonus: 0, gaps: 0 },
    },
    {
      category: 'bracket' as const,
      points: 70,
      detail: { hitsByPhase: { '1/16': 5, '1/8': 2, cuartos: 1 } },
    },
    {
      category: 'podium' as const,
      points: 28,
      detail: { hits: ['champion', 'third'] },
    },
    {
      category: 'awards' as const,
      points: 19,
      detail: { hits: ['boot_gold', 'ball_silver'] },
    },
    {
      category: 'penalties' as const,
      points: -3,
      detail: { groupMatchGaps: 3, groupStandingGaps: 0, bestThirdGaps: 0 },
    },
  ];

  it('totalPoints es la suma de las 7 filas (incluida la penalización negativa)', () => {
    // 120 + 40 + 12 + 70 + 28 + 19 - 3 = 286.
    expect(extractRankingMetrics(rows).totalPoints).toBe(286);
  });

  it('§7.1 exactGroupMatches sale de group_matches.detail.reasons.exact', () => {
    expect(extractRankingMetrics(rows).exactGroupMatches).toBe(9);
  });

  it('§7.2 bracketHits suma todos los hitsByPhase', () => {
    // 5 + 2 + 1 = 8.
    expect(extractRankingMetrics(rows).bracketHits).toBe(8);
  });

  it('§7.3-7.5 campeón/subcampeón/3.º salen de podium.detail.hits', () => {
    const m = extractRankingMetrics(rows);
    expect(m.championHit).toBe(true);
    expect(m.runnerUpHit).toBe(false);
    expect(m.thirdHit).toBe(true);
  });

  it('§7.6 exactGroups sale de group_standings.detail.exactGroups', () => {
    expect(extractRankingMetrics(rows).exactGroups).toBe(3);
  });

  it('§7.7 awardHits es la longitud de awards.detail.hits', () => {
    expect(extractRankingMetrics(rows).awardHits).toBe(2);
  });

  it('filas ausentes → métricas a cero / false (usuario sin scores)', () => {
    const m = extractRankingMetrics([]);
    expect(m).toEqual({
      totalPoints: 0,
      exactGroupMatches: 0,
      bracketHits: 0,
      championHit: false,
      runnerUpHit: false,
      thirdHit: false,
      exactGroups: 0,
      awardHits: 0,
    });
  });

  it('el orden de las filas de entrada es indiferente', () => {
    const shuffled = [rows[3], rows[6], rows[0], rows[5], rows[1], rows[4], rows[2]];
    expect(extractRankingMetrics(shuffled)).toEqual({
      totalPoints: 286,
      exactGroupMatches: 9,
      bracketHits: 8,
      championHit: true,
      runnerUpHit: false,
      thirdHit: true,
      exactGroups: 3,
      awardHits: 2,
    });
  });
});
