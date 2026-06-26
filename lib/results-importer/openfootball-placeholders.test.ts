import { describe, expect, it } from 'vitest';

import { looksLikeOpenfootballPlaceholder } from './openfootball-placeholders';

describe('looksLikeOpenfootballPlaceholder', () => {
  it('reconoce los formatos de openfootball para slots no resueltos', () => {
    expect(looksLikeOpenfootballPlaceholder('1A')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('1F')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('1L')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('2A')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('2K')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('2L')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('3A/B/C/D/F')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('3C/D/F/G/H')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('3E/H/I/J/K')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('W73')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('L101')).toBe(true);
  });

  it('NO reconoce nombres de equipo legítimos como placeholders', () => {
    expect(looksLikeOpenfootballPlaceholder('Brazil')).toBe(false);
    expect(looksLikeOpenfootballPlaceholder('Germany')).toBe(false);
    expect(looksLikeOpenfootballPlaceholder('South Africa')).toBe(false);
    expect(looksLikeOpenfootballPlaceholder('USA')).toBe(false); // 3 letras todas mayúsculas
    expect(looksLikeOpenfootballPlaceholder('DR Congo')).toBe(false);
    expect(looksLikeOpenfootballPlaceholder('')).toBe(false);
  });

  it('es tolerante con espacios alrededor', () => {
    expect(looksLikeOpenfootballPlaceholder('  1A  ')).toBe(true);
    expect(looksLikeOpenfootballPlaceholder('  Brazil  ')).toBe(false);
  });
});
