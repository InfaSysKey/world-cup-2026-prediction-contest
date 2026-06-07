import { describe, expect, it } from 'vitest';

import { checkBestThirdsCoherence } from './cross-tab';

const STANDINGS = [
  { groupLetter: 'A', position: 1, teamCode: 'MEX' },
  { groupLetter: 'A', position: 3, teamCode: 'USA' },
  { groupLetter: 'B', position: 3, teamCode: 'ESP' },
];

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
