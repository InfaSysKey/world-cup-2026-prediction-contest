import { describe, expect, it } from 'vitest';

import { MATCHES } from '@/lib/db/seed/matches';

import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';
import {
  BEST_THIRDS_SLOT_MATCH_IDS,
  resolveBestThirds,
} from './resolve-best-thirds';

// thirdsByGroup identidad: el "tercero" del grupo X es el propio código X. Así el
// resultado de resolveBestThirds es directamente {matchId -> letra de grupo},
// legible y comparable contra los valores conocidos del Excel.
const IDENTITY_THIRDS: Record<string, string> = Object.fromEntries(
  'ABCDEFGHIJKL'.split('').map((l) => [l, l]),
);

const SLOT_IDS = [...BEST_THIRDS_SLOT_MATCH_IDS].sort((a, b) => a - b);

// Elegibilidad de cada slot de 3.º, derivada de forma INDEPENDIENTE del seed (el
// away_slot_ref "3XXXXX" de los partidos de 1/16). Es la fuente del cross-check
// permanente: distinta hoja del Excel y distinto método (validación, no lookup).
const ELIGIBILITY = new Map<number, Set<string>>();
for (const m of MATCHES) {
  if (m.phase === '1/16' && m.awaySlotRef && /^3[A-L]+$/.test(m.awaySlotRef)) {
    ELIGIBILITY.set(m.id, new Set(m.awaySlotRef.slice(1).split('')));
  }
}

// 24 combinaciones con su reparto esperado {matchId -> grupo}, transcritas de
// BEST_THIRDS_MAPPING (Excel oficial) como snapshot legible. Cubren casos
// "regulares" y atípicos (74 recibe A; 81 recibe E/F/J; 82 recibe H/I; etc.), que
// son justo donde la elección de FIFA no sigue ningún patrón posicional.
const EXPECTED: ReadonlyArray<readonly [string, Record<number, string>]> = [
  ['ABCDEFGH', { 74: 'C', 77: 'F', 79: 'H', 80: 'E', 81: 'B', 82: 'A', 85: 'G', 87: 'D' }],
  ['ABCDEFGI', { 74: 'D', 77: 'F', 79: 'C', 80: 'I', 81: 'B', 82: 'A', 85: 'G', 87: 'E' }],
  ['ABCDEFGK', { 74: 'D', 77: 'F', 79: 'C', 80: 'K', 81: 'B', 82: 'A', 85: 'G', 87: 'E' }],
  ['ABCDEFGL', { 74: 'D', 77: 'F', 79: 'C', 80: 'E', 81: 'B', 82: 'A', 85: 'G', 87: 'L' }],
  ['ABCDEFHI', { 74: 'C', 77: 'F', 79: 'H', 80: 'I', 81: 'B', 82: 'A', 85: 'E', 87: 'D' }],
  ['ABCDEFHL', { 74: 'C', 77: 'D', 79: 'H', 80: 'E', 81: 'B', 82: 'A', 85: 'F', 87: 'L' }],
  ['ABCDEFKL', { 74: 'D', 77: 'F', 79: 'C', 80: 'K', 81: 'B', 82: 'A', 85: 'E', 87: 'L' }],
  ['ABCDEGHI', { 74: 'C', 77: 'D', 79: 'H', 80: 'I', 81: 'B', 82: 'A', 85: 'G', 87: 'E' }],
  ['ABCDEGIJ', { 74: 'C', 77: 'D', 79: 'E', 80: 'J', 81: 'B', 82: 'A', 85: 'G', 87: 'I' }],
  ['ABCDEHKL', { 74: 'C', 77: 'D', 79: 'H', 80: 'K', 81: 'B', 82: 'A', 85: 'E', 87: 'L' }],
  ['ABCDFGHL', { 74: 'D', 77: 'F', 79: 'C', 80: 'H', 81: 'B', 82: 'A', 85: 'G', 87: 'L' }],
  ['ABCDGIJK', { 74: 'D', 77: 'G', 79: 'C', 80: 'K', 81: 'B', 82: 'A', 85: 'J', 87: 'I' }],
  ['ABCDIJKL', { 74: 'C', 77: 'D', 79: 'I', 80: 'K', 81: 'B', 82: 'A', 85: 'J', 87: 'L' }],
  ['ABCEGIKL', { 74: 'A', 77: 'C', 79: 'E', 80: 'K', 81: 'B', 82: 'I', 85: 'G', 87: 'L' }],
  ['ABCFGIJK', { 74: 'F', 77: 'G', 79: 'C', 80: 'K', 81: 'B', 82: 'A', 85: 'J', 87: 'I' }],
  ['ABDEGHIK', { 74: 'D', 77: 'H', 79: 'E', 80: 'K', 81: 'B', 82: 'A', 85: 'G', 87: 'I' }],
  ['ABDFGIJK', { 74: 'D', 77: 'G', 79: 'F', 80: 'K', 81: 'B', 82: 'A', 85: 'J', 87: 'I' }],
  ['ABEFGHIK', { 74: 'F', 77: 'H', 79: 'E', 80: 'K', 81: 'B', 82: 'A', 85: 'G', 87: 'I' }],
  ['ABEGHIJK', { 74: 'A', 77: 'G', 79: 'E', 80: 'K', 81: 'B', 82: 'H', 85: 'J', 87: 'I' }],
  ['ABGHIJKL', { 74: 'A', 77: 'G', 79: 'H', 80: 'K', 81: 'B', 82: 'I', 85: 'J', 87: 'L' }],
  ['ACDEFGHI', { 74: 'C', 77: 'F', 79: 'H', 80: 'I', 81: 'E', 82: 'A', 85: 'G', 87: 'D' }],
  ['ACDEFGHL', { 74: 'C', 77: 'D', 79: 'H', 80: 'E', 81: 'F', 82: 'A', 85: 'G', 87: 'L' }],
  ['ACDEFGIK', { 74: 'D', 77: 'F', 79: 'C', 80: 'K', 81: 'E', 82: 'A', 85: 'G', 87: 'I' }],
  ['ADEFGHIJ', { 74: 'D', 77: 'F', 79: 'H', 80: 'I', 81: 'J', 82: 'A', 85: 'G', 87: 'E' }],
];

describe('resolveBestThirds (slice 6, data-model.md §9)', () => {
  describe('casos conocidos del Excel (matchId -> grupo)', () => {
    for (const [combo, expected] of EXPECTED) {
      it(combo, () => {
        expect(resolveBestThirds(combo.split(''), IDENTITY_THIRDS)).toEqual(
          expected,
        );
      });
    }
  });

  it('mapea la letra de grupo al código de equipo de su tercero', () => {
    const thirds: Record<string, string> = {
      A: 'MEX', B: 'CHE', C: 'BRA', D: 'AUS',
      E: 'DEU', F: 'JPN', G: 'BEL', H: 'ESP',
    };
    // Reparto de ABCDEFGH: {74:C, 77:F, 79:H, 80:E, 81:B, 82:A, 85:G, 87:D}.
    expect(resolveBestThirds('ABCDEFGH'.split(''), thirds)).toEqual({
      74: 'BRA', 77: 'JPN', 79: 'ESP', 80: 'DEU',
      81: 'CHE', 82: 'MEX', 85: 'BEL', 87: 'AUS',
    });
  });

  it('es indiferente al orden de qualifiedGroups', () => {
    expect(resolveBestThirds('HGFEDCBA'.split(''), IDENTITY_THIRDS)).toEqual(
      resolveBestThirds('ABCDEFGH'.split(''), IDENTITY_THIRDS),
    );
  });

  it('devuelve exactamente los 8 slots de 1/16 que reciben tercero', () => {
    const out = resolveBestThirds('EFGHIJKL'.split(''), IDENTITY_THIRDS);
    expect(Object.keys(out).map(Number).sort((a, b) => a - b)).toEqual(SLOT_IDS);
  });

  it('lanza si la combinación no tiene 8 grupos distintos', () => {
    expect(() => resolveBestThirds('ABCDEFG'.split(''), IDENTITY_THIRDS)).toThrow();
    expect(() =>
      resolveBestThirds('ABCDEFGHI'.split(''), IDENTITY_THIRDS),
    ).toThrow();
  });

  it('lanza si falta el tercero de algún grupo de la combinación', () => {
    const incomplete = { ...IDENTITY_THIRDS };
    delete incomplete.C;
    expect(() =>
      resolveBestThirds('ABCDEFGH'.split(''), incomplete),
    ).toThrow(/grupo C/);
  });
});

// Cross-check PERMANENTE (el más importante): el enfoque elegido (A, lookup de
// tabla) coincide con un modelo de restricciones independiente sobre las 495
// combinaciones. El modelo no reconstruye el reparto (está subdeterminado: cada
// combinación admite 3–214 emparejamientos válidos), pero sí verifica que el de
// la tabla es SIEMPRE un emparejamiento perfecto legal según la elegibilidad
// derivada del seed. Si alguien regenera la tabla o los slot_ref y rompen la
// coherencia, este test lo caza.
describe('cross-check permanente: tabla vs modelo de restricciones (495)', () => {
  it('el seed define exactamente los 8 slots de 3.º esperados', () => {
    expect([...ELIGIBILITY.keys()].sort((a, b) => a - b)).toEqual(SLOT_IDS);
  });

  it('resolveBestThirds da un emparejamiento perfecto legal en las 495', () => {
    let checked = 0;
    for (const combo of Object.keys(BEST_THIRDS_MAPPING)) {
      const groups = combo.split('');
      // IDENTITY_THIRDS -> el resultado es {matchId -> letra de grupo}.
      const out = resolveBestThirds(groups, IDENTITY_THIRDS);

      // (a) asigna exactamente los 8 slots de 1/16 que reciben tercero.
      expect(Object.keys(out).map(Number).sort((a, b) => a - b)).toEqual(SLOT_IDS);
      // (b) los grupos asignados son una permutación de la combinación.
      expect(new Set(Object.values(out))).toEqual(new Set(groups));
      // (c) cada grupo respeta la elegibilidad del slot (fuente: seed/matches.ts).
      for (const [idStr, group] of Object.entries(out)) {
        expect(ELIGIBILITY.get(Number(idStr))?.has(group)).toBe(true);
      }
      checked += 1;
    }
    expect(checked).toBe(495);
  });
});
