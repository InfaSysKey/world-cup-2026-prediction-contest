import { describe, expect, it } from 'vitest';

import { bestThirdsCases } from './__fixtures__/best-thirds';
import { scoreBestThirds } from './best-thirds';
import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';

// Puntuación de los mejores terceros (scoring-rules.md §3.3). Función PURA: entra
// la selección ordenada del usuario (8 posiciones, null = hueco) y el conjunto
// oficial de 8, sale el desglose. 3 pts por acierto (membresía, sin importar el
// orden interno) + bonus +5 si los 8 coinciden en orden exacto. Los huecos no
// restan aquí: emptyPositions lo consume la fila penalties del orquestador (§4).

describe('scoreBestThirds (§3.3)', () => {
  for (const c of bestThirdsCases) {
    it(c.name, () => {
      expect(scoreBestThirds(c.predicted, c.official)).toEqual(c.expected);
    });
  }

  it('el bonus de orden exige los 8 en su posición exacta (máximo 29)', () => {
    const max = Math.max(
      ...bestThirdsCases.map(
        (c) => scoreBestThirds(c.predicted, c.official).points,
      ),
    );
    expect(max).toBe(29);
  });

  it('points nunca incluye penalización por huecos', () => {
    const official = bestThirdsCases[0].official;
    const empty = scoreBestThirds(new Array(8).fill(null), official);
    expect(empty.points).toBe(0);
    expect(empty.emptyPositions).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Tests de BEST_THIRDS_MAPPING — formato para el resolver de 1/16 (slice 6).
// Se conservan del slice 4.4: verifican el formato del mapa de combinaciones.
// ---------------------------------------------------------------------------

describe('BEST_THIRDS_MAPPING — formato para resolver de 1/16', () => {
  const THIRD_SLOTS_1_16 = [74, 77, 79, 80, 81, 82, 85, 87] as const;

  it('tiene exactamente 495 combinaciones C(12,8)', () => {
    expect(Object.keys(BEST_THIRDS_MAPPING)).toHaveLength(495);
  });

  it('cada clave es exactamente 8 letras entre A–L, ordenadas', () => {
    const letters = new Set('ABCDEFGHIJKL'.split(''));
    for (const key of Object.keys(BEST_THIRDS_MAPPING)) {
      expect(key).toHaveLength(8);
      expect(key).toMatch(/^[A-L]{8}$/);
      const sorted = key.split('').sort().join('');
      expect(key).toBe(sorted);
      expect(new Set(key.split('')).size).toBe(8);
      for (const ch of key.split('')) {
        expect(letters.has(ch)).toBe(true);
      }
    }
  });

  it('cada combinación asigna exactamente los 8 slots de 1/16 que reciben terceros', () => {
    const expectedSlots = [...THIRD_SLOTS_1_16].sort((a, b) => a - b);
    for (const [, assignment] of Object.entries(BEST_THIRDS_MAPPING)) {
      const slots = Object.keys(assignment).map(Number).sort((a, b) => a - b);
      expect(slots).toEqual(expectedSlots);
    }
  });

  it('el grupo asignado a cada slot pertenece a los 8 que clasifican tercero', () => {
    for (const [combo, assignment] of Object.entries(BEST_THIRDS_MAPPING)) {
      const groupsInCombo = new Set(combo.split(''));
      for (const group of Object.values(assignment)) {
        expect(groupsInCombo.has(group)).toBe(true);
      }
    }
  });

  it('cada grupo en la combinación aparece exactamente una vez en la asignación', () => {
    for (const [combo, assignment] of Object.entries(BEST_THIRDS_MAPPING)) {
      const assignedGroups = Object.values(assignment);
      expect(new Set(assignedGroups).size).toBe(8);
      const groupsInCombo = new Set(combo.split(''));
      for (const g of assignedGroups) {
        expect(groupsInCombo.has(g)).toBe(true);
      }
    }
  });

  it('la combinación "ABCDEFGH" se resuelve contra los valores conocidos del Excel', () => {
    expect(BEST_THIRDS_MAPPING['ABCDEFGH']).toEqual({
      74: 'C', 77: 'F', 79: 'H', 80: 'E', 81: 'B', 82: 'A', 85: 'G', 87: 'D',
    });
  });

  it('la combinación "EFGHIJKL" se resuelve contra los valores conocidos del Excel', () => {
    expect(BEST_THIRDS_MAPPING['EFGHIJKL']).toEqual({
      74: 'F', 77: 'G', 79: 'E', 80: 'K', 81: 'I', 82: 'H', 85: 'J', 87: 'L',
    });
  });

  it('el formato de cada entrada es compatible con el resolver de 1/16 de slice 6', () => {
    for (const [, assignment] of Object.entries(BEST_THIRDS_MAPPING)) {
      for (const [matchIdStr, groupLetter] of Object.entries(assignment)) {
        const matchId = Number(matchIdStr);
        expect(THIRD_SLOTS_1_16).toContain(matchId as (typeof THIRD_SLOTS_1_16)[number]);
        expect(groupLetter).toMatch(/^[A-L]$/);
      }
    }
  });
});
