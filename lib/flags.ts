// Código de bandera (ISO 3166-1 alpha-2, o subregión gb-eng/gb-sct para Inglaterra
// y Escocia) que usa flag-icons. Se deriva del propio flagEmoji del equipo, así
// que no hace falta columna nueva ni mapa de 48 entradas: los emoji de bandera ya
// codifican el país (indicadores regionales) o la subregión (secuencia de tags).
// Pura y testeable; la usan los loaders del data layer (slice 10.4).

// Respaldo por código alpha-3 si el emoji no se pudiera parsear (no debería pasar
// con el catálogo sembrado, pero evita devolver un código inválido).
const SPECIAL_BY_CODE: Record<string, string> = {
  ENG: 'gb-eng',
  SCO: 'gb-sct',
  WAL: 'gb-wls',
  NIR: 'gb-nir',
};

const REGIONAL_A = 0x1f1e6; // 🇦
const REGIONAL_Z = 0x1f1ff; // 🇿
const BLACK_FLAG = 0x1f3f4; // 🏴
const TAG_A = 0xe0061; // etiqueta 'a'
const TAG_Z = 0xe007a; // etiqueta 'z'
const LOWER_A = 0x61; // 'a'

export function flagIconCode(flagEmoji: string, code: string): string {
  const points = Array.from(flagEmoji, (ch) => ch.codePointAt(0) ?? 0);

  // Dos indicadores regionales (🇲🇽) → alpha-2 ("mx").
  if (
    points.length === 2 &&
    points.every((cp) => cp >= REGIONAL_A && cp <= REGIONAL_Z)
  ) {
    return points
      .map((cp) => String.fromCharCode(cp - REGIONAL_A + LOWER_A))
      .join('');
  }

  // Bandera negra + etiquetas (🏴 + "gbeng") → "gb-eng".
  if (points[0] === BLACK_FLAG) {
    const tags = points
      .slice(1)
      .filter((cp) => cp >= TAG_A && cp <= TAG_Z)
      .map((cp) => String.fromCharCode(cp - TAG_A + LOWER_A))
      .join('');
    if (tags.startsWith('gb') && tags.length > 2) {
      return `gb-${tags.slice(2)}`;
    }
    if (tags.length > 0) {
      return tags;
    }
  }

  return SPECIAL_BY_CODE[code] ?? code.toLowerCase();
}
