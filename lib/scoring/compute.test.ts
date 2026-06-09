import { describe, expect, it } from 'vitest';

import {
  affectedCategoriesFor,
  computeScoreRows,
  type ScoringInputs,
} from './compute';

// Núcleo PURO del orquestador (lib/scoring/compute.ts). Estos tests NO tocan BD:
// construyen un ScoringInputs conocido y comprueban el desglose por categoría
// contra una tabla calculada A MANO, más la idempotencia de la función pura y el
// mapa de recálculo selectivo.

// Escenario con porra conocida + oficiales conocidos. Tabla calculada a mano:
//   group_matches : m1 exacto 5; m2 fallo 0; m3 sin predicción (hueco); m4 anulado
//                   → 5 puntos, 1 hueco.
//   group_standings: A clavado 15; B con 1 hueco → 4+2+1 = 7 → 22, 1 hueco.
//   best_thirds   : 7 de 8 (1 hueco) → 21, 1 hueco.
//   bracket       : 1/16 acertado 4; final fallada 0 → 4.
//   podium        : campeón 20 + 3.º 8 (subcampeón fallado) → 28.
//   awards        : bota oro acertada (match tolerante) 15 → 15.
//   penalties     : 1 + 1 + 1 = 3 huecos → −3.
//   TOTAL         : 5 + 22 + 21 + 4 + 28 + 15 − 3 = 92.
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
  bestThirds: {
    official: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'],
    predicted: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', null],
  },
  knockout: [
    {
      matchId: 74,
      phase: '1/16',
      cancelled: false,
      realWinnerTeamCode: 'X',
      pick: 'X',
    },
    {
      matchId: 104,
      phase: 'final',
      cancelled: false,
      realWinnerTeamCode: 'Z',
      pick: 'Y',
    },
  ],
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

describe('computeScoreRows — desglose calculado a mano', () => {
  it('cada categoría coincide con la tabla a mano', () => {
    const points = pointsByCategory(SCENARIO);
    expect(points).toEqual({
      group_matches: 5,
      group_standings: 22,
      best_thirds: 21,
      bracket: 4,
      podium: 28,
      awards: 15,
      penalties: -3,
    });
  });

  it('el total (suma de las 7 filas) es 92', () => {
    const total = computeScoreRows(SCENARIO).reduce(
      (sum, r) => sum + r.points,
      0,
    );
    expect(total).toBe(92);
  });

  it('la fila penalties centraliza los 3 huecos (Modelo A)', () => {
    const penalties = computeScoreRows(SCENARIO).find(
      (r) => r.category === 'penalties',
    );
    expect(penalties?.points).toBe(-3);
    expect(penalties?.detail).toEqual({
      groupMatchGaps: 1,
      groupStandingGaps: 1,
      bestThirdGaps: 1,
    });
  });

  it('las filas de categoría no incluyen los −1 (solo positivos)', () => {
    const rows = computeScoreRows(SCENARIO);
    for (const r of rows) {
      if (r.category !== 'penalties') {
        expect(r.points).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('es determinista: dos ejecuciones devuelven el mismo snapshot literal', () => {
    const expected = {
      group_matches: 5,
      group_standings: 22,
      best_thirds: 21,
      bracket: 4,
      podium: 28,
      awards: 15,
      penalties: -3,
    };
    expect(pointsByCategory(SCENARIO)).toEqual(expected);
    expect(pointsByCategory(SCENARIO)).toEqual(expected);
  });

  it('produce siempre las 7 categorías', () => {
    const cats = computeScoreRows(SCENARIO)
      .map((r) => r.category)
      .sort();
    expect(cats).toEqual(
      [
        'awards',
        'best_thirds',
        'bracket',
        'group_matches',
        'group_standings',
        'penalties',
        'podium',
      ].sort(),
    );
  });
});

describe('affectedCategoriesFor — recálculo selectivo', () => {
  it('un resultado de grupos solo afecta a group_matches', () => {
    expect(affectedCategoriesFor({ type: 'group_match', matchId: 1 })).toEqual([
      'group_matches',
    ]);
  });

  it('un resultado de cruce solo afecta a bracket', () => {
    expect(affectedCategoriesFor({ type: 'knockout', matchId: 74 })).toEqual([
      'bracket',
    ]);
  });

  it('la clasificación de un grupo solo afecta a group_standings', () => {
    expect(
      affectedCategoriesFor({ type: 'group_standings', groupLetter: 'A' }),
    ).toEqual(['group_standings']);
  });

  it('los mejores terceros solo afectan a best_thirds', () => {
    expect(affectedCategoriesFor({ type: 'best_thirds' })).toEqual([
      'best_thirds',
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

  it('NINGÚN cambio de resultado recalcula penalties', () => {
    const changes = [
      { type: 'group_match', matchId: 1 },
      { type: 'knockout', matchId: 74 },
      { type: 'group_standings', groupLetter: 'A' },
      { type: 'best_thirds' },
      { type: 'award', awardKind: 'champion' },
      { type: 'award', awardKind: 'ball_gold' },
    ] as const;
    for (const c of changes) {
      expect(affectedCategoriesFor(c)).not.toContain('penalties');
    }
  });
});
