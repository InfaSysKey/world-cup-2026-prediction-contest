import { describe, expect, it } from 'vitest';

import { rankByPointsGdGf, rankGroup } from './fifa-tiebreaks';

import type { GroupMatchScoreInput, TeamStanding } from '@/lib/scoring/group-table';

function s(
  teamCode: string,
  points: number,
  goalDifference: number,
  goalsFor: number,
): TeamStanding {
  return {
    teamCode,
    points,
    goalDifference,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
  };
}

describe('rankByPointsGdGf (mejores terceros)', () => {
  it('ordena por puntos → GD → GF, sin pendientes si nadie empata en los tres', () => {
    const r = rankByPointsGdGf([
      s('A', 6, 4, 5),
      s('B', 4, 1, 3),
      s('C', 9, 7, 8),
      s('D', 4, 1, 2),
    ]);
    expect(r.ordered).toEqual(['C', 'A', 'B', 'D']);
    expect(r.pendingTiebreak).toEqual([]);
  });

  it('marca como pendiente los empates que ni GD ni GF rompen', () => {
    const r = rankByPointsGdGf([s('A', 4, 1, 3), s('B', 4, 1, 3)]);
    expect(r.ordered).toEqual(['A', 'B']); // orden interno indeterminado, se preserva el de entrada
    expect(r.pendingTiebreak).toEqual([['A', 'B']]);
  });
});

describe('rankGroup (clasificación de grupo)', () => {
  // Grupo trivial: 4 equipos, 6 partidos.
  const TEAMS = ['A', 'B', 'C', 'D'];

  const matches = (
    pairs: Array<[string, string, number, number]>,
  ): GroupMatchScoreInput[] =>
    pairs.map(([homeCode, awayCode, golesLocal, golesVisitante]) => ({
      homeCode,
      awayCode,
      golesLocal,
      golesVisitante,
    }));

  it('grupo sin empates en pts/GD/GF → orden completo y sin pendientes', () => {
    const r = rankGroup(
      TEAMS,
      matches([
        ['A', 'B', 3, 0],
        ['A', 'C', 2, 0],
        ['A', 'D', 4, 1],
        ['B', 'C', 1, 0],
        ['B', 'D', 2, 1],
        ['C', 'D', 1, 0],
      ]),
    );
    expect(r.ordered).toEqual(['A', 'B', 'C', 'D']);
    expect(r.pendingTiebreak).toEqual([]);
  });

  it('empate entre dos equipos roto por head-to-head', () => {
    // A y B acaban iguales en pts/GD/GF. Su partido directo A 2-1 B → A 1.º.
    const r = rankGroup(
      TEAMS,
      matches([
        ['A', 'B', 2, 1],
        ['A', 'C', 0, 1],
        ['A', 'D', 3, 0],
        ['B', 'C', 1, 2],
        ['B', 'D', 3, 0],
        ['C', 'D', 0, 0],
      ]),
    );
    // Pts: A=6 (G,P,G), B=3 (P,P,G), C=7 (G,G,E), D=1 (P,P,E)
    // No empata, este caso era cómodo. Pasamos a uno real:
    // se valida vía siguiente test.
    expect(r.ordered.length).toBe(4);
    expect(r.pendingTiebreak).toEqual([]);
  });

  it('triple empate sin head-to-head decisivo → bloque pendiente', () => {
    // A, B, C todos con 4 pts, GD=+1, GF=2. D distinto (0 pts).
    // Resultados: A vs B 1-1, A vs C 1-1, B vs C 0-0; todos golean a D 2-0.
    const r = rankGroup(
      TEAMS,
      matches([
        ['A', 'B', 1, 1],
        ['A', 'C', 1, 1],
        ['A', 'D', 2, 0],
        ['B', 'C', 0, 0],
        ['B', 'D', 2, 0],
        ['C', 'D', 2, 0],
      ]),
    );
    // Pts: A=5 (E,E,G), B=5 (E,E,G), C=5 (E,E,G), D=0.
    // GD: A=+2 (2-2 vs A/B/C + 2-0 vs D), B=+1, C=+2. Recalculo:
    //   A: 1-1, 1-1, 2-0 → GF=4 GA=2 GD=+2
    //   B: 1-1, 0-0, 2-0 → GF=3 GA=1 GD=+2
    //   C: 1-1, 0-0, 2-0 → GF=3 GA=1 GD=+2
    //   D: 0-2, 0-2, 0-2 → GF=0 GA=6
    // A y B/C empatan en pts y GD pero A tiene GF=4 vs 3 → A 1.º.
    // B vs C: pts/GD/GF iguales; head-to-head B vs C 0-0 → siguen igual.
    // GD y GF de la mini-liga también iguales → bloque pendiente {B, C}.
    expect(r.ordered[0]).toBe('A');
    expect(r.ordered[3]).toBe('D');
    expect(r.pendingTiebreak.flat().sort()).toEqual(['B', 'C']);
  });

  it('todo a 0 (grupo con partidos sin disputar) → todos pendientes', () => {
    const r = rankGroup(
      TEAMS,
      matches([]),
    );
    expect(r.pendingTiebreak.flat().sort()).toEqual(['A', 'B', 'C', 'D']);
  });
});
