import { describe, expect, it } from 'vitest';

import {
  extractRankingMetrics,
  rankPlayers,
  snapshotPositions,
  type RankingMetrics,
  type RankingPlayer,
} from './ranking';

// Ranking general y desempates (scoring-rules.md §7, v2.0). Funciones PURAS:
// entran las métricas agregadas de cada jugador, sale el orden con su rango. El
// criterio 8 (sorteo público) NO se aleatoriza aquí: los empates genuinos quedan
// con el mismo rango y `needsDraw=true` para que el admin los resuelva con
// random.org.
//
// Los esperados se calculan A MANO leyendo §7, nunca derivados de la función.

// Métricas base (todo a cero / false); cada test sobreescribe solo lo relevante.
function metrics(partial: Partial<RankingMetrics> = {}): RankingMetrics {
  return {
    totalPoints: 0,
    exactGroupMatches: 0,
    exactKnockoutMatches: 0,
    teamAdvancementHits: 0,
    championHit: false,
    runnerUpHit: false,
    thirdHit: false,
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

describe('rankPlayers — los 7 criterios de desempate en orden (§7 v2.0)', () => {
  it('§7.1: empate a puntos → más marcadores exactos de grupos gana', () => {
    const players = [
      player(1, 'ana', { totalPoints: 100, exactGroupMatches: 5 }),
      player(2, 'ben', { totalPoints: 100, exactGroupMatches: 9 }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.2: igualados hasta §7.1 → más marcadores exactos de eliminatorias gana', () => {
    const players = [
      player(1, 'ana', {
        totalPoints: 100,
        exactGroupMatches: 7,
        exactKnockoutMatches: 2,
      }),
      player(2, 'ben', {
        totalPoints: 100,
        exactGroupMatches: 7,
        exactKnockoutMatches: 5,
      }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.3: igualados hasta §7.2 → más equipos clasificados acertados gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
    };
    const players = [
      player(1, 'ana', { ...base, teamAdvancementHits: 8 }),
      player(2, 'ben', { ...base, teamAdvancementHits: 15 }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.4: igualados hasta §7.3 → haber acertado el campeón gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
    };
    const players = [
      player(1, 'ana', { ...base, championHit: false }),
      player(2, 'ben', { ...base, championHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.5: igualados hasta §7.4 → haber acertado el subcampeón gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
      championHit: true,
    };
    const players = [
      player(1, 'ana', { ...base, runnerUpHit: false }),
      player(2, 'ben', { ...base, runnerUpHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.6: igualados hasta §7.5 → haber acertado el 3.º puesto gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
      championHit: true,
      runnerUpHit: true,
    };
    const players = [
      player(1, 'ana', { ...base, thirdHit: false }),
      player(2, 'ben', { ...base, thirdHit: true }),
    ];
    expect(order(players)).toEqual(['ben', 'ana']);
  });

  it('§7.7: igualados hasta §7.6 → más premios individuales acertados gana', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
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
        exactKnockoutMatches: 20,
        teamAdvancementHits: 50,
        championHit: true,
        runnerUpHit: true,
        thirdHit: true,
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
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
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
      exactKnockoutMatches: 2,
      teamAdvancementHits: 4,
      championHit: false,
      runnerUpHit: false,
      thirdHit: false,
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
    const out1 = order([player(2, 'ben', same), player(1, 'ana', same)]);
    const out2 = order([player(1, 'ana', same), player(2, 'ben', same)]);
    expect(out1).toEqual(['ana', 'ben']);
    expect(out2).toEqual(['ana', 'ben']);
  });

  it('una diferencia mínima en el último criterio rompe el empate (sin needsDraw)', () => {
    const base = {
      totalPoints: 100,
      exactGroupMatches: 7,
      exactKnockoutMatches: 3,
      teamAdvancementHits: 10,
      championHit: true,
      runnerUpHit: true,
      thirdHit: true,
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

describe('extractRankingMetrics — lee las métricas de §7 del desglose de scores v2.0', () => {
  // Filas tal como las produce compute.ts v2.0 (detail jsonb por categoría).
  const rows = [
    {
      category: 'group_matches' as const,
      points: 120,
      detail: { reasons: { exact: 9, result: 4, wrong: 1, empty: 0 } },
    },
    {
      category: 'group_standings' as const,
      points: 40,
      detail: { emptyPositions: 0 },
    },
    {
      category: 'bracket' as const,
      points: 50,
      detail: {
        reasons: { exact: 4, result: 6, wrong: 2, empty: 0 },
        exactByPhase: { '1/16': 2, '1/8': 1, cuartos: 1 },
      },
    },
    {
      category: 'team_advancement' as const,
      points: 40,
      detail: {
        byPhase: [
          { phase: '1/16', hits: 12, points: 24 },
          { phase: '1/8', hits: 4, points: 8 },
          { phase: 'cuartos', hits: 2, points: 4 },
          { phase: 'semi', hits: 1, points: 2 },
          { phase: '3-4', hits: 1, points: 2 },
          { phase: 'final', hits: 0, points: 0 },
        ],
      },
    },
    {
      category: 'podium' as const,
      points: 40,
      detail: { hits: ['champion', 'third'] },
    },
    {
      category: 'awards' as const,
      points: 17,
      detail: { hits: ['boot_gold', 'ball_silver'] },
    },
  ];

  it('totalPoints es la suma de las 6 filas', () => {
    // 120 + 40 + 50 + 40 + 40 + 17 = 307.
    expect(extractRankingMetrics(rows).totalPoints).toBe(307);
  });

  it('§7.1 exactGroupMatches sale de group_matches.detail.reasons.exact', () => {
    expect(extractRankingMetrics(rows).exactGroupMatches).toBe(9);
  });

  it('§7.2 exactKnockoutMatches sale de bracket.detail.reasons.exact', () => {
    expect(extractRankingMetrics(rows).exactKnockoutMatches).toBe(4);
  });

  it('§7.3 teamAdvancementHits suma los hits de todas las fases', () => {
    // 12 + 4 + 2 + 1 + 1 + 0 = 20.
    expect(extractRankingMetrics(rows).teamAdvancementHits).toBe(20);
  });

  it('§7.4-7.6 campeón/subcampeón/3.º salen de podium.detail.hits', () => {
    const m = extractRankingMetrics(rows);
    expect(m.championHit).toBe(true);
    expect(m.runnerUpHit).toBe(false);
    expect(m.thirdHit).toBe(true);
  });

  it('§7.7 awardHits es la longitud de awards.detail.hits', () => {
    expect(extractRankingMetrics(rows).awardHits).toBe(2);
  });

  it('filas ausentes → métricas a cero / false (usuario sin scores)', () => {
    const m = extractRankingMetrics([]);
    expect(m).toEqual({
      totalPoints: 0,
      exactGroupMatches: 0,
      exactKnockoutMatches: 0,
      teamAdvancementHits: 0,
      championHit: false,
      runnerUpHit: false,
      thirdHit: false,
      awardHits: 0,
    });
  });

  it('el orden de las filas de entrada es indiferente', () => {
    const shuffled = [rows[3], rows[5], rows[0], rows[4], rows[1], rows[2]];
    expect(extractRankingMetrics(shuffled)).toEqual({
      totalPoints: 307,
      exactGroupMatches: 9,
      exactKnockoutMatches: 4,
      teamAdvancementHits: 20,
      championHit: true,
      runnerUpHit: false,
      thirdHit: true,
      awardHits: 2,
    });
  });
});

describe('snapshotPositions — { userId: rank } para los deltas (§7)', () => {
  it('mapea cada userId (como string) a su rango de competición', () => {
    const positions = snapshotPositions([
      player(10, 'ben', { totalPoints: 100 }),
      player(20, 'cas', { totalPoints: 80 }),
      player(30, 'ana', { totalPoints: 60 }),
    ]);
    expect(positions).toEqual({ '10': 1, '20': 2, '30': 3 });
  });

  it('los empatados genuinos comparten rango (1,2,2,4)', () => {
    const tied = { totalPoints: 80 };
    const positions = snapshotPositions([
      player(1, 'top', { totalPoints: 100 }),
      player(2, 'tieA', tied),
      player(3, 'tieB', tied),
      player(4, 'low', { totalPoints: 50 }),
    ]);
    expect(positions).toEqual({ '1': 1, '2': 2, '3': 2, '4': 4 });
  });

  it('sin jugadores → objeto vacío', () => {
    expect(snapshotPositions([])).toEqual({});
  });
});
