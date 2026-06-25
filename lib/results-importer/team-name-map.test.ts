import { describe, expect, it } from 'vitest';

import { TEAMS } from '@/lib/db/seed/teams';

import {
  knownOpenfootballNames,
  teamCodeFromOpenfootball,
} from './team-name-map';

describe('teamCodeFromOpenfootball', () => {
  it('cubre los 48 códigos FIFA del seed (cada team.code tiene al menos un nombre EN mapeado)', () => {
    const allCodes = new Set(TEAMS.map((t) => t.code));
    const mappedCodes = new Set(
      knownOpenfootballNames().map((name) => teamCodeFromOpenfootball(name)),
    );
    const missing = [...allCodes].filter((c) => !mappedCodes.has(c));
    expect(missing).toEqual([]);
  });

  it('resuelve grafías habituales del JSON de openfootball', () => {
    expect(teamCodeFromOpenfootball('South Africa')).toBe('ZAF');
    expect(teamCodeFromOpenfootball('South Korea')).toBe('KOR');
    expect(teamCodeFromOpenfootball('Czech Republic')).toBe('CZE');
    expect(teamCodeFromOpenfootball('Bosnia & Herzegovina')).toBe('BIH');
    expect(teamCodeFromOpenfootball('DR Congo')).toBe('COD');
    expect(teamCodeFromOpenfootball('Ivory Coast')).toBe('CIV');
    expect(teamCodeFromOpenfootball('Curaçao')).toBe('CUW');
  });

  it('es robusto frente a espacios y mayúsculas', () => {
    expect(teamCodeFromOpenfootball('  SPAIN  ')).toBe('ESP');
    expect(teamCodeFromOpenfootball('mexico')).toBe('MEX');
  });

  it('acepta alias razonables (Czechia, Côte d Ivoire, Türkiye)', () => {
    expect(teamCodeFromOpenfootball('Czechia')).toBe('CZE');
    expect(teamCodeFromOpenfootball("Côte d'Ivoire")).toBe('CIV');
    expect(teamCodeFromOpenfootball('Türkiye')).toBe('TUR');
    expect(teamCodeFromOpenfootball('United States')).toBe('USA');
  });

  it('devuelve null para nombres desconocidos en vez de lanzar', () => {
    expect(teamCodeFromOpenfootball('Atlantis')).toBeNull();
    expect(teamCodeFromOpenfootball('')).toBeNull();
  });
});
