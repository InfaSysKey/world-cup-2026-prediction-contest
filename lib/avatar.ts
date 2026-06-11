// Color de acento e iniciales de un jugador derivados de su nick, deterministas:
// el mismo nick produce siempre el mismo color (design-system §10.6). Presentación
// pura y testeable; la usan la cabecera (menú de cuenta), el ranking y los perfiles.

// Paleta de acentos para avatares. Tonos profundos y saturados: todos superan
// contraste AA (≥4.5:1) con el texto blanco que va encima (quality floor §8).
export const AVATAR_ACCENTS = [
  '#2347E8', // cobalto
  '#7C3AED', // violeta
  '#0F766E', // teal
  '#C2410C', // ámbar quemado
  '#BE185D', // magenta
  '#0369A1', // azul cielo
  '#166534', // verde
  '#B91C1C', // rojo
] as const;

// Hash estable (variante de djb2/FNV simplificada) sobre los code points del nick.
// No es criptográfico: solo necesitamos reparto determinista y bien distribuido.
function hashNick(nick: string): number {
  let hash = 0;
  for (let i = 0; i < nick.length; i += 1) {
    hash = (hash * 31 + nick.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function playerAccent(nick: string): string {
  const cleaned = nick.trim();
  if (cleaned.length === 0) {
    return AVATAR_ACCENTS[0];
  }
  return AVATAR_ACCENTS[hashNick(cleaned) % AVATAR_ACCENTS.length];
}

export function playerInitials(nick: string): string {
  const cleaned = nick.trim();
  if (cleaned.length === 0) {
    return '?';
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}
