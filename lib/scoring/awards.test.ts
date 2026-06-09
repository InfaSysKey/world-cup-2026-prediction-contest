import { describe, expect, it } from 'vitest';

import { awardCases } from './__fixtures__/awards';
import { normalizePlayerName, scoreAwards } from './awards';

// Puntuación de los premios individuales (scoring-rules.md §3.6). Función PURA:
// entra el pick por premio (nombre de jugador o null) y el oficial, sale un
// AwardScore por premio. Match case-insensitive + trim + sin tildes (4.7).
// Premio vacío o jugador que no participa (§6.6) → 0, sin penalización.

describe('normalizePlayerName', () => {
  it('quita tildes, pasa a minúsculas, recorta y colapsa espacios', () => {
    expect(normalizePlayerName('  KYLIAN   MBAPPÉ ')).toBe('kylian mbappe');
  });

  it('nombres equivalentes normalizan al mismo valor', () => {
    expect(normalizePlayerName('Luka Modrić')).toBe(
      normalizePlayerName('luka modric'),
    );
  });
});

describe('scoreAwards (§3.6)', () => {
  for (const c of awardCases) {
    it(c.name, () => {
      expect(scoreAwards(c.picks, c.official)).toEqual(c.expected);
    });
  }

  it('el máximo de premios es 50 (15+8+5+12+6+4)', () => {
    const all = awardCases[0];
    const total = scoreAwards(all.picks, all.official).reduce(
      (sum, s) => sum + s.points,
      0,
    );
    expect(total).toBe(50);
  });
});
