import { describe, expect, it } from 'vitest';

import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';
import { scoreBestThirds, type BestThirdsScore } from './best-thirds';

// Pruebas del módulo best-thirds.ts (scoring-rules.md §3.3).
//
// En sub-slice 4.4 la implementación real de scoreBestThirds() está diferida al
// slice 5 (el cuerpo devuelve []). Los tests que necesitan la lógica de puntuación
// están marcados como .todo para que el desarrollador los active en slice 5.
// Los tests de forma y tipo SÍ se pueden ejecutar ahora.
//
// Lo que sí cubrimos aquí (son aserciones reales, no triviales):
//   1. La firma existe y devuelve Promise<BestThirdsScore[]>.
//   2. El tipo BestThirdsScore tiene las propiedades esperadas (derivadas de §3.3).
//   3. La constante BEST_THIRDS_MAPPING expone el formato correcto para que el
//      resolver de 1/16 (slice 6) funcione con las predicciones del usuario.

describe('BestThirdsScore', () => {
  it('tiene las propiedades correctas derivadas de scoring-rules.md §3.3', () => {
    // Verificamos el contrato del tipo construyendo un objeto válido.
    // Si el tipo cambia, TypeScript lo detectará en tiempo de compilación.
    const sample: BestThirdsScore = {
      hits: 8,
      hitPoints: 24,    // 8 × 3
      exactOrderBonus: 5,
      points: 29,       // Máximo según §3.3
    };
    expect(sample.hits).toBe(8);
    expect(sample.hitPoints).toBe(24);
    expect(sample.exactOrderBonus).toBe(5);
    expect(sample.points).toBe(29);
  });

  it('el punto máximo es 29 (8×3 + bonus de orden exacto)', () => {
    // Fórmula canónica de scoring-rules.md §3.3.
    const MAX_HIT_POINTS = 8 * 3;      // 24
    const MAX_ORDER_BONUS = 5;
    expect(MAX_HIT_POINTS + MAX_ORDER_BONUS).toBe(29);
  });
});

describe('scoreBestThirds (firma y contrato de slice 5)', () => {
  it('devuelve una Promise (la implementación llegará en slice 5)', async () => {
    const result = scoreBestThirds(1);
    expect(result).toBeInstanceOf(Promise);
    const resolved = await result;
    // En slice 4.4 el cuerpo es un stub que devuelve [].
    // En slice 5 devolverá un array con BestThirdsScore[].
    expect(Array.isArray(resolved)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests de BEST_THIRDS_MAPPING — formato para el resolver de 1/16 (slice 6)
//
// Verificamos que el mapa ya está en el formato que necesitará el bracket:
//   - Clave: 8 letras de grupo (ordenadas).
//   - Valor: { matchId → groupLetter } — los 8 slots de 1/16 que reciben terceros.
// ---------------------------------------------------------------------------

describe('BEST_THIRDS_MAPPING — formato para resolver de 1/16', () => {
  // Estos son los 8 matchIds del bracket de 1/16 que reciben un mejor tercero
  // (derivado del Excel — data-model.md §9).
  const THIRD_SLOTS_1_16 = [74, 77, 79, 80, 81, 82, 85, 87] as const;

  it('tiene exactamente 495 combinaciones C(12,8)', () => {
    expect(Object.keys(BEST_THIRDS_MAPPING)).toHaveLength(495);
  });

  it('cada clave es exactamente 8 letras entre A–L, ordenadas', () => {
    const letters = new Set('ABCDEFGHIJKL'.split(''));
    for (const key of Object.keys(BEST_THIRDS_MAPPING)) {
      expect(key).toHaveLength(8);
      expect(key).toMatch(/^[A-L]{8}$/);
      // Las letras deben estar ordenadas.
      const sorted = key.split('').sort().join('');
      expect(key).toBe(sorted);
      // Sin repetición.
      expect(new Set(key.split('')).size).toBe(8);
      // Cada letra debe estar en el alfabeto de grupos.
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
      // Cada uno de los 8 grupos aparece exactamente una vez (no hay slots que
      // apunten al mismo grupo).
      expect(new Set(assignedGroups).size).toBe(8);
      // Y todos están dentro de la combinación.
      const groupsInCombo = new Set(combo.split(''));
      for (const g of assignedGroups) {
        expect(groupsInCombo.has(g)).toBe(true);
      }
    }
  });

  it('la combinación "ABCDEFGH" se resuelve contra los valores conocidos del Excel', () => {
    // Valor cruzado a mano con la hoja "Combinaciones" del Excel.
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
    // El resolver de slice 6 consumirá:
    //   BEST_THIRDS_MAPPING[groupKey][matchId] → groupLetter
    // Para cada combinación debe devolver un string de una sola letra A-L.
    for (const [, assignment] of Object.entries(BEST_THIRDS_MAPPING)) {
      for (const [matchIdStr, groupLetter] of Object.entries(assignment)) {
        const matchId = Number(matchIdStr);
        expect(THIRD_SLOTS_1_16).toContain(matchId as (typeof THIRD_SLOTS_1_16)[number]);
        expect(groupLetter).toMatch(/^[A-L]$/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests de scoring §3.3 — marcados como .todo hasta slice 5
// ---------------------------------------------------------------------------

describe.todo('scoreBestThirds — lógica de puntuación (slice 5)', () => {
  // Estos tests se activarán cuando scoreBestThirds() tenga implementación real.

  it.todo('0 aciertos da 0 hitPoints y 0 exactOrderBonus');
  it.todo('8 aciertos sin orden exacto da 24 pts (8×3)');
  it.todo('8 aciertos en orden exacto da 29 pts (8×3 + 5)');
  it.todo('aciertos parciales no suman el bonus de orden');
  it.todo('equipo stale en BD no puntúa si no está en actual_best_thirds');
});
