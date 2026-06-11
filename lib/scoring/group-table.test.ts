import { describe, expect, it } from 'vitest';

import {
  computeGroupPoints,
  findTiedBlocks,
  type GroupMatchScoreInput,
  type TeamStanding,
} from './group-table';

const TEAMS = ['AAA', 'BBB', 'CCC', 'DDD'];

// Los 6 partidos de un grupo de 4 (todos contra todos).
function pairings(
  scores: Array<[string, string, number | null, number | null]>,
): GroupMatchScoreInput[] {
  return scores.map(([homeCode, awayCode, golesLocal, golesVisitante]) => ({
    homeCode,
    awayCode,
    golesLocal,
    golesVisitante,
  }));
}

// Atajo para construir una fila de la tabla a mano en los tests de findTiedBlocks.
function row(
  teamCode: string,
  points: number,
  goalsFor: number,
  goalsAgainst: number,
): TeamStanding {
  return {
    teamCode,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
  };
}

describe('computeGroupPoints', () => {
  it('reparte 3/1/0 y calcula puntos, goles a favor/en contra y diferencia', () => {
    // AAA gana todo (9), BBB gana 2 (6), CCC gana 1 (3), DDD pierde todo (0).
    const matches = pairings([
      ['AAA', 'BBB', 1, 0],
      ['AAA', 'CCC', 1, 0],
      ['AAA', 'DDD', 1, 0],
      ['BBB', 'CCC', 1, 0],
      ['BBB', 'DDD', 1, 0],
      ['CCC', 'DDD', 1, 0],
    ]);

    const standings = computeGroupPoints(TEAMS, matches);

    expect(standings).toEqual([
      { teamCode: 'AAA', points: 9, goalsFor: 3, goalsAgainst: 0, goalDifference: 3 },
      { teamCode: 'BBB', points: 6, goalsFor: 2, goalsAgainst: 1, goalDifference: 1 },
      { teamCode: 'CCC', points: 3, goalsFor: 1, goalsAgainst: 2, goalDifference: -1 },
      { teamCode: 'DDD', points: 0, goalsFor: 0, goalsAgainst: 3, goalDifference: -3 },
    ]);
    expect(findTiedBlocks(standings)).toEqual([]);
  });

  it('acumula goles de marcadores abultados en ambos lados', () => {
    const matches = pairings([
      ['AAA', 'BBB', 3, 1], // AAA +3 (gf3 ga1), BBB (gf1 ga3)
      ['BBB', 'AAA', 2, 2], // empate (BBB +1 gf2 ga2, AAA +1 gf2 ga2)
    ]);

    const standings = computeGroupPoints(['AAA', 'BBB'], matches);

    expect(standings).toEqual([
      { teamCode: 'AAA', points: 4, goalsFor: 5, goalsAgainst: 3, goalDifference: 2 },
      { teamCode: 'BBB', points: 1, goalsFor: 3, goalsAgainst: 5, goalDifference: -2 },
    ]);
  });

  it('ignora partidos incompletos: produce puntos y goles parciales', () => {
    const matches = pairings([
      ['AAA', 'BBB', 2, 0], // cuenta
      ['CCC', 'DDD', null, null], // hueco: no cuenta
      ['AAA', 'CCC', 1, null], // hueco parcial: no cuenta
    ]);

    const standings = computeGroupPoints(TEAMS, matches);

    expect(standings).toEqual([
      { teamCode: 'AAA', points: 3, goalsFor: 2, goalsAgainst: 0, goalDifference: 2 },
      { teamCode: 'BBB', points: 0, goalsFor: 0, goalsAgainst: 2, goalDifference: -2 },
      { teamCode: 'CCC', points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
      { teamCode: 'DDD', points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
    ]);
  });
});

describe('findTiedBlocks', () => {
  it('sin empates devuelve lista vacía', () => {
    expect(
      findTiedBlocks([row('AAA', 9, 3, 0), row('BBB', 6, 2, 1)]),
    ).toEqual([]);
  });

  it('NO agrupa equipos con los mismos puntos pero distinta diferencia de goles', () => {
    // Ambos a 4 puntos, pero GD +4 vs +1: el reglamento ya los separa.
    expect(
      findTiedBlocks([row('AAA', 4, 5, 1), row('BBB', 4, 3, 2)]),
    ).toEqual([]);
  });

  it('NO agrupa equipos con mismos puntos y GD pero distintos goles a favor', () => {
    // Ambos a 4 puntos y GD +3, pero 5 vs 4 goles a favor: separados.
    expect(
      findTiedBlocks([row('AAA', 4, 5, 2), row('BBB', 4, 4, 1)]),
    ).toEqual([]);
  });

  it('agrupa solo a los equipos iguales en puntos, diferencia y goles a favor', () => {
    // AAA y BBB iguales (4 / +3 / 5); CCC empata a puntos y GD pero mete 6 → fuera.
    expect(
      findTiedBlocks([
        row('AAA', 4, 5, 2),
        row('BBB', 4, 5, 2),
        row('CCC', 4, 6, 3),
      ]),
    ).toEqual([['AAA', 'BBB']]);
  });

  it('detecta un empate triple en los tres criterios', () => {
    expect(
      findTiedBlocks([
        row('AAA', 6, 3, 1),
        row('BBB', 6, 3, 1),
        row('CCC', 6, 3, 1),
        row('DDD', 0, 0, 6),
      ]),
    ).toEqual([['AAA', 'BBB', 'CCC']]);
  });

  it('devuelve varios bloques ordenados por la cadena puntos → GD → GF', () => {
    // Dos pares empatados: el de más puntos primero.
    expect(
      findTiedBlocks([
        row('AAA', 7, 5, 1),
        row('BBB', 7, 5, 1),
        row('CCC', 1, 1, 5),
        row('DDD', 1, 1, 5),
      ]),
    ).toEqual([
      ['AAA', 'BBB'],
      ['CCC', 'DDD'],
    ]);
  });

  it('con mismos puntos ordena los bloques por diferencia de goles', () => {
    expect(
      findTiedBlocks([
        row('AAA', 4, 2, 1), // GD +1
        row('BBB', 4, 2, 1), // GD +1
        row('CCC', 4, 3, 0), // GD +3
        row('DDD', 4, 3, 0), // GD +3
      ]),
    ).toEqual([
      ['CCC', 'DDD'],
      ['AAA', 'BBB'],
    ]);
  });
});

describe('computeGroupPoints + findTiedBlocks (integración)', () => {
  it('un ciclo simétrico deja a tres equipos empatados en los tres criterios', () => {
    // AAA→BBB→CCC→AAA (1-0 cada uno) y los tres ganan 2-0 a DDD.
    const matches = pairings([
      ['AAA', 'BBB', 1, 0],
      ['BBB', 'CCC', 1, 0],
      ['CCC', 'AAA', 1, 0],
      ['AAA', 'DDD', 2, 0],
      ['BBB', 'DDD', 2, 0],
      ['CCC', 'DDD', 2, 0],
    ]);

    const standings = computeGroupPoints(TEAMS, matches);

    expect(standings).toEqual([
      { teamCode: 'AAA', points: 6, goalsFor: 3, goalsAgainst: 1, goalDifference: 2 },
      { teamCode: 'BBB', points: 6, goalsFor: 3, goalsAgainst: 1, goalDifference: 2 },
      { teamCode: 'CCC', points: 6, goalsFor: 3, goalsAgainst: 1, goalDifference: 2 },
      { teamCode: 'DDD', points: 0, goalsFor: 0, goalsAgainst: 6, goalDifference: -6 },
    ]);
    expect(findTiedBlocks(standings)).toEqual([['AAA', 'BBB', 'CCC']]);
  });

  it('empate solo a puntos roto por diferencia de goles: no hay bloque', () => {
    // AAA y BBB a 4 puntos, pero distinta diferencia de goles.
    const matches = pairings([
      ['AAA', 'CCC', 3, 0], // AAA +3 (gf3 ga0)
      ['BBB', 'CCC', 1, 0], // BBB +3 (gf1 ga0)
      ['AAA', 'BBB', 1, 1], // empate (AAA +1, BBB +1)
    ]);

    const standings = computeGroupPoints(TEAMS, matches);

    // AAA: 4 pts, GD +3; BBB: 4 pts, GD +1 → empatan a puntos pero GD separa.
    expect(standings[0]).toEqual({
      teamCode: 'AAA',
      points: 4,
      goalsFor: 4,
      goalsAgainst: 1,
      goalDifference: 3,
    });
    expect(standings[1]).toEqual({
      teamCode: 'BBB',
      points: 4,
      goalsFor: 2,
      goalsAgainst: 1,
      goalDifference: 1,
    });
    expect(findTiedBlocks(standings)).toEqual([]);
  });
});
