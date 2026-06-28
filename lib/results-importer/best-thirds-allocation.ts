// Asignación de los 8 mejores terceros a los 8 cruces de 1/16 que enfrentan
// a un ganador de grupo contra un tercero. Implementa la tabla "Annex C" del
// Reglamento FIFA World Cup 2026.
//
// Por qué: los slot_refs `3XYZW...` del seed (lib/db/seed/matches.ts) listan
// los grupos POSIBLES de los que puede venir un tercero a ese cruce, pero
// múltiples cruces se solapan entre sí. Cuando los 8 terceros reales vienen de
// 8 grupos concretos (de los 12), el matching bipartito NO es único: hay
// varias asignaciones perfectas posibles. FIFA elige UNA (Annex C, 495
// entradas) que no es derivable algorítmicamente.
//
// Esta tabla cubre SOLO la combinación real del Mundial 2026 (los 8 grupos que
// efectivamente aportaron mejor tercero). Si por descalificación retroactiva,
// re-decisión administrativa, etc., la combinación cambia, el lookup devolverá
// null y el orquestador reportará `THIRDS_COMBINATION_UNKNOWN` con la clave
// observada — entonces se añade aquí la nueva entrada (8 cruces × 1 línea).
//
// Verificado contra https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage

// Clave de combinación: 8 letras de grupo en orden alfabético, mayúsculas.
// Ej. "BDEFIJKL" = los grupos B, D, E, F, I, J, K, L aportaron tercero.
type CombinationKey = string;

// Para cada slot_ref tipo "3XYZ...", el grupo del tercero asignado por Annex C.
type AllocationBySlot = Readonly<Record<string, string>>;

const ANNEX_C: Readonly<Record<CombinationKey, AllocationBySlot>> = {
  // Mundial 2026 — combinación real publicada el 27-jun (grupos B, D, E, F,
  // I, J, K, L aportan mejor tercero; A, C, G, H se quedan fuera).
  BDEFIJKL: {
    '3ABCDF': 'D', // 1E (Alemania)  ↔ 3D (Paraguay)
    '3CDFGH': 'F', // 1I (Francia)   ↔ 3F (Suecia)
    '3CEFHI': 'E', // 1A (México)    ↔ 3E (Ecuador)
    '3EHIJK': 'K', // 1L (Inglaterra) ↔ 3K (RD Congo)
    '3BEFIJ': 'B', // 1D (EE. UU.)   ↔ 3B (Bosnia)
    '3AEHIJ': 'I', // 1G (Bélgica)   ↔ 3I (Senegal)
    '3EFGIJ': 'J', // 1B (Suiza)     ↔ 3J (Argelia)
    '3DEIJL': 'L', // 1K (Colombia)  ↔ 3L (Ghana)
  },
};

// Construye la clave canónica a partir de los grupos efectivamente representados
// en `actual_best_thirds`. Devuelve null si no hay exactamente 8 grupos distintos
// (la tabla solo aplica con el set completo).
export function buildCombinationKey(
  groupLettersFromBestThirds: ReadonlyArray<string>,
): CombinationKey | null {
  const unique = new Set(groupLettersFromBestThirds.map((g) => g.toUpperCase()));
  if (unique.size !== 8) return null;
  return [...unique].sort().join('');
}

// Devuelve el groupLetter del tercero que FIFA asigna al slot_ref dado para la
// combinación recibida. null si la combinación no está en la tabla o el
// slot_ref no aparece en ella.
export function lookupBestThirdGroupForSlot(
  combinationKey: CombinationKey,
  slotRef: string,
): string | null {
  return ANNEX_C[combinationKey]?.[slotRef] ?? null;
}

// Para tests / debug: ¿qué combinaciones tenemos cubiertas?
export function knownCombinations(): ReadonlyArray<CombinationKey> {
  return Object.keys(ANNEX_C);
}
