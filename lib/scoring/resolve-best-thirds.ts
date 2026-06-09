// Resolución de los mejores terceros a sus cruces de 1/16 (data-model.md §9).
// Función PURA: entran el conjunto de los 8 grupos cuyo 3.º clasifica y el equipo
// que es 3.º de cada grupo; sale, por cada uno de los 8 partidos de 1/16 que
// reciben un tercero, qué equipo ocupa ese slot "3X". Cargar los resultados
// oficiales y persistir el reparto es cosa del caller (admin action), no de aquí.
//
// Por qué un lookup de tabla y NO un algoritmo derivado: el reparto está
// subdeterminado. Las reglas posicionales de FIFA (los conjuntos de elegibilidad
// de cada slot — los away_slot_ref "3XXXXX" de seed/matches.ts) admiten entre 3 y
// 214 emparejamientos válidos para CADA una de las 495 combinaciones; ninguna es
// única. BEST_THIRDS_MAPPING (hoja "Combinaciones" del Excel oficial) codifica la
// elección concreta de FIFA entre esos válidos, que no se deriva de ninguna regla
// posicional. Por eso la tabla es la única fuente correcta. La garantía de que
// cada fila de la tabla es un emparejamiento legal según la elegibilidad (fuente
// independiente: el seed) es el cross-check permanente de resolve-best-thirds.test.ts.

import { BEST_THIRDS_MAPPING } from './best-thirds-mapping';

// Los 8 partidos de 1/16 cuyo slot visitante lo ocupa un mejor tercero. El reparto
// concreto por combinación de grupos vive en best-thirds-mapping.ts.
export const BEST_THIRDS_SLOT_MATCH_IDS = [
  74, 77, 79, 80, 81, 82, 85, 87,
] as const;

export function resolveBestThirds(
  qualifiedGroups: readonly string[],
  thirdsByGroup: Readonly<Record<string, string>>,
): Record<number, string> {
  const combo = [...new Set(qualifiedGroups)].sort().join('');
  if (!(combo in BEST_THIRDS_MAPPING)) {
    throw new Error(
      `Combinación de mejores terceros inválida (${combo}): se esperaban 8 grupos distintos de A–L.`,
    );
  }
  const assignment = BEST_THIRDS_MAPPING[combo];

  const result: Record<number, string> = {};
  for (const [matchId, groupLetter] of Object.entries(assignment)) {
    if (!(groupLetter in thirdsByGroup)) {
      throw new Error(
        `Falta el tercero del grupo ${groupLetter} para resolver los mejores terceros.`,
      );
    }
    result[Number(matchId)] = thirdsByGroup[groupLetter];
  }
  return result;
}
