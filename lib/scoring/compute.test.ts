import { describe, expect, it } from 'vitest';

import {
  affectedCategoriesFor,
  computeScoreRows,
  type ScoringInputs,
} from './compute';

// Núcleo PURO del orquestador (lib/scoring/compute.ts) en v2.0. Estos tests NO
// tocan BD: construyen un ScoringInputs conocido y comprueban el desglose por
// las 6 categorías contra una tabla calculada A MANO, más la idempotencia y el
// mapa de recálculo selectivo (ADR 0009).

// Escenario con porra conocida + oficiales conocidos. Tabla calculada a mano
// (v2.2 — ADR 0012, exacto = 8 (3 signo + 5 exacto)):
//   group_matches    : m1 exacto 8; m2 wrong 0; m3 sin predicción 0; m4 anulado 0
//                      → 8 puntos.
//   group_standings  : A clavado (2+2+2+2=8); B con 1 hueco (2+2+2=6) → 14.
//   bracket          : 1/16 marcador exacto (3-1) → 8; final wrong → 0 → 8.
//   team_advancement : 1/16 → 2 aciertos × 2 = 4; resto de fases sin oficial → 0
//                      → 4 puntos.
//   podium           : campeón 30 + 3.º 10 (subcampeón fallado) → 40.
//   awards           : bota oro acertada (match tolerante) 10 → 10.
//   TOTAL            : 8 + 14 + 8 + 4 + 40 + 10 = 84.
const SCENARIO: ScoringInputs = {
  groupMatches: [
    {
      matchId: 1,
      cancelled: false,
      official: { golesLocal: 2, golesVisitante: 1 },
      prediction: { golesLocal: 2, golesVisitante: 1 },
    },
    {
      matchId: 2,
      cancelled: false,
      official: { golesLocal: 0, golesVisitante: 3 },
      prediction: { golesLocal: 2, golesVisitante: 1 },
    },
    {
      matchId: 3,
      cancelled: false,
      official: { golesLocal: 0, golesVisitante: 0 },
      prediction: null,
    },
    {
      matchId: 4,
      cancelled: true,
      official: null,
      prediction: { golesLocal: 1, golesVisitante: 1 },
    },
  ],
  groups: [
    {
      groupLetter: 'A',
      official: ['A1', 'A2', 'A3', 'A4'],
      predicted: ['A1', 'A2', 'A3', 'A4'],
    },
    {
      groupLetter: 'B',
      official: ['B1', 'B2', 'B3', 'B4'],
      predicted: ['B1', null, 'B3', 'B4'],
    },
  ],
  knockoutMarkers: [
    {
      matchId: 74,
      phase: '1/16',
      cancelled: false,
      official: { golesLocal: 3, golesVisitante: 1 },
      prediction: { golesLocal: 3, golesVisitante: 1 },
    },
    {
      matchId: 104,
      phase: 'final',
      cancelled: false,
      official: { golesLocal: 2, golesVisitante: 0 },
      prediction: { golesLocal: 1, golesVisitante: 2 },
    },
  ],
  teamAdvancement: {
    predicted: {
      '1/16': ['ESP', 'ARG'],
      '1/8': [],
      cuartos: [],
      semi: [],
      '3-4': [],
      final: [],
    },
    actual: {
      '1/16': ['ESP', 'ARG'],
      '1/8': null,
      cuartos: null,
      semi: null,
      '3-4': null,
      final: null,
    },
  },
  podium: {
    picks: { champion: 'C', runner_up: 'R', third: 'D' },
    official: { champion: 'C', runner_up: 'Q', third: 'D' },
  },
  awards: {
    picks: {
      boot_gold: 'kylian mbappe',
      boot_silver: null,
      boot_bronze: null,
      ball_gold: null,
      ball_silver: null,
      ball_bronze: null,
    },
    official: {
      boot_gold: 'Kylian Mbappé',
      boot_silver: 'Harry Kane',
      boot_bronze: 'Julián Álvarez',
      ball_gold: 'Lionel Messi',
      ball_silver: 'Luka Modrić',
      ball_bronze: 'Antoine Griezmann',
    },
  },
};

function pointsByCategory(inputs: ScoringInputs): Record<string, number> {
  return Object.fromEntries(
    computeScoreRows(inputs).map((r) => [r.category, r.points]),
  );
}

describe('computeScoreRows — desglose calculado a mano (v2.0)', () => {
  it('cada categoría coincide con la tabla a mano', () => {
    const points = pointsByCategory(SCENARIO);
    expect(points).toEqual({
      group_matches: 8,
      group_standings: 14,
      bracket: 8,
      team_advancement: 4,
      podium: 40,
      awards: 10,
    });
  });

  it('el total (suma de las 6 filas) es 84', () => {
    const total = computeScoreRows(SCENARIO).reduce(
      (sum, r) => sum + r.points,
      0,
    );
    expect(total).toBe(84);
  });

  it('todas las filas son ≥ 0 (v2.0 no tiene penalizaciones)', () => {
    const rows = computeScoreRows(SCENARIO);
    for (const r of rows) {
      expect(r.points).toBeGreaterThanOrEqual(0);
    }
  });

  it('es determinista: dos ejecuciones devuelven el mismo snapshot literal', () => {
    const expected = {
      group_matches: 8,
      group_standings: 14,
      bracket: 8,
      team_advancement: 4,
      podium: 40,
      awards: 10,
    };
    expect(pointsByCategory(SCENARIO)).toEqual(expected);
    expect(pointsByCategory(SCENARIO)).toEqual(expected);
  });

  it('produce siempre las 6 categorías v2.0', () => {
    const cats = computeScoreRows(SCENARIO)
      .map((r) => r.category)
      .sort();
    expect(cats).toEqual(
      [
        'awards',
        'bracket',
        'group_matches',
        'group_standings',
        'podium',
        'team_advancement',
      ].sort(),
    );
  });
});

describe('affectedCategoriesFor — recálculo selectivo (v2.0)', () => {
  it('un resultado de grupos solo afecta a group_matches', () => {
    expect(affectedCategoriesFor({ type: 'group_match', matchId: 1 })).toEqual([
      'group_matches',
    ]);
  });

  it('un resultado de cruce afecta a bracket Y team_advancement', () => {
    expect(affectedCategoriesFor({ type: 'knockout', matchId: 74 })).toEqual([
      'bracket',
      'team_advancement',
    ]);
  });

  it('la clasificación de un grupo afecta a group_standings Y team_advancement', () => {
    expect(
      affectedCategoriesFor({ type: 'group_standings', groupLetter: 'A' }),
    ).toEqual(['group_standings', 'team_advancement']);
  });

  it('los mejores terceros oficiales afectan solo a team_advancement', () => {
    expect(affectedCategoriesFor({ type: 'best_thirds' })).toEqual([
      'team_advancement',
    ]);
  });

  it('un premio de podio afecta a podium; una bota/balón a awards', () => {
    expect(
      affectedCategoriesFor({ type: 'award', awardKind: 'champion' }),
    ).toEqual(['podium']);
    expect(
      affectedCategoriesFor({ type: 'award', awardKind: 'boot_gold' }),
    ).toEqual(['awards']);
  });
});
