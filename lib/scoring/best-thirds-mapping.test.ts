import { describe, expect, it } from 'vitest';

import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';

describe('BEST_THIRDS_MAPPING', () => {
  it('tiene las 495 combinaciones C(12,8)', () => {
    expect(Object.keys(BEST_THIRDS_MAPPING)).toHaveLength(495);
  });

  it('cada combinación asigna los 8 slots de 1/16 que reciben un tercero', () => {
    const HOST_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87];
    for (const [combo, inner] of Object.entries(BEST_THIRDS_MAPPING)) {
      expect(combo).toMatch(/^[A-L]{8}$/);
      expect(Object.keys(inner).map(Number).sort((a, b) => a - b)).toEqual(
        HOST_MATCHES,
      );
      // El grupo asignado debe estar entre los 8 que clasifican tercero.
      for (const group of Object.values(inner)) {
        expect(combo).toContain(group);
      }
    }
  });

  // Valores cruzados a mano contra la hoja `Combinaciones` del Excel.
  it('resuelve combinaciones conocidas', () => {
    expect(BEST_THIRDS_MAPPING['ABCDEFGH']).toEqual({
      74: 'C', 77: 'F', 79: 'H', 80: 'E', 81: 'B', 82: 'A', 85: 'G', 87: 'D',
    });
    expect(BEST_THIRDS_MAPPING['ABCDEFGI']).toEqual({
      74: 'D', 77: 'F', 79: 'C', 80: 'I', 81: 'B', 82: 'A', 85: 'G', 87: 'E',
    });
    expect(BEST_THIRDS_MAPPING['EFGHIJKL']).toEqual({
      74: 'F', 77: 'G', 79: 'E', 80: 'K', 81: 'I', 82: 'H', 85: 'J', 87: 'L',
    });
  });
});
