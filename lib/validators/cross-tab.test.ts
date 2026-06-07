import { describe, expect, it } from 'vitest';

import {
  analyzeBestThirdsStale,
  analyzePodiumBracketMismatch,
  checkBestThirdsCoherence,
} from './cross-tab';

const STANDINGS = [
  { groupLetter: 'A', position: 1, teamCode: 'MEX' },
  { groupLetter: 'A', position: 3, teamCode: 'USA' },
  { groupLetter: 'B', position: 3, teamCode: 'ESP' },
];

const TEAM_GROUP = new Map([
  ['MEX', 'A'],
  ['USA', 'A'],
  ['CAN', 'A'],
  ['ESP', 'B'],
  ['POR', 'B'],
]);

describe('checkBestThirdsCoherence', () => {
  it('no emite avisos si todos los terceros están en 3.ª posición', () => {
    const issues = checkBestThirdsCoherence(STANDINGS, [
      { position: 1, teamCode: 'USA' },
      { position: 2, teamCode: 'ESP' },
    ]);
    expect(issues).toEqual([]);
  });

  it('emite un warning por cada tercero que no es 3.º en ningún grupo', () => {
    const issues = checkBestThirdsCoherence(STANDINGS, [
      { position: 1, teamCode: 'USA' }, // ok
      { position: 2, teamCode: 'CAN' }, // no es 3.º en ningún grupo
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].code).toBe('BEST_THIRD_NOT_IN_STANDINGS');
  });

  it('no peta con listas vacías', () => {
    expect(checkBestThirdsCoherence([], [])).toEqual([]);
  });
});

describe('analyzeBestThirdsStale', () => {
  it('no marca nada si todas las selecciones siguen siendo 3.º de su grupo', () => {
    const stale = analyzeBestThirdsStale(
      STANDINGS,
      [
        { position: 1, teamCode: 'USA' },
        { position: 2, teamCode: 'ESP' },
      ],
      TEAM_GROUP,
    );
    expect(stale).toEqual([]);
  });

  it('marca stale con el grupo y el 3.º actual como sustituto', () => {
    // El usuario eligió CAN (grupo A) pero ahora el 3.º del grupo A es USA.
    const stale = analyzeBestThirdsStale(
      STANDINGS,
      [{ position: 1, teamCode: 'CAN' }],
      TEAM_GROUP,
    );
    expect(stale).toEqual([
      { teamCode: 'CAN', groupLetter: 'A', replacement: 'USA' },
    ]);
  });

  it('da replacement null si el grupo del equipo no tiene 3.º predicho', () => {
    // POR pertenece al grupo B, pero el 3.º del grupo B en STANDINGS es ESP;
    // si quitamos ese 3.º no hay sustituto.
    const standingsSinTerceroB = STANDINGS.filter(
      (s) => !(s.groupLetter === 'B' && s.position === 3),
    );
    const stale = analyzeBestThirdsStale(
      standingsSinTerceroB,
      [{ position: 1, teamCode: 'POR' }],
      TEAM_GROUP,
    );
    expect(stale).toEqual([
      { teamCode: 'POR', groupLetter: 'B', replacement: null },
    ]);
  });

  it('no peta con listas vacías', () => {
    expect(analyzeBestThirdsStale([], [], new Map())).toEqual([]);
  });
});

describe('analyzePodiumBracketMismatch', () => {
  it('no emite nada si el podio coincide con el bracket', () => {
    const saved = { champion: 'ESP', runnerUp: 'FRA', third: 'POR' };
    expect(analyzePodiumBracketMismatch(saved, saved)).toEqual([]);
  });

  it('emite un mismatch por cada puesto que difiere del bracket', () => {
    const out = analyzePodiumBracketMismatch(
      { champion: 'BRA', runnerUp: 'FRA', third: 'POR' },
      { champion: 'ESP', runnerUp: 'FRA', third: 'POR' },
    );
    expect(out).toEqual([{ kind: 'champion', saved: 'BRA', expected: 'ESP' }]);
  });

  it('marca como mismatch un puesto vacío cuando el bracket sí lo deduce', () => {
    const out = analyzePodiumBracketMismatch(
      { champion: null, runnerUp: null, third: null },
      { champion: 'ESP', runnerUp: 'FRA', third: 'POR' },
    );
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.kind)).toEqual(['champion', 'runnerUp', 'third']);
  });

  it('ignora los puestos que el bracket no puede deducir (deducción null)', () => {
    const out = analyzePodiumBracketMismatch(
      { champion: 'BRA', runnerUp: 'FRA', third: 'POR' },
      { champion: 'ESP', runnerUp: null, third: null },
    );
    expect(out).toEqual([{ kind: 'champion', saved: 'BRA', expected: 'ESP' }]);
  });
});
