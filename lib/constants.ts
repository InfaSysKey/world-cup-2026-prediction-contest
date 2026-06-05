// Coste de bcrypt para el hashing de contraseñas (CLAUDE.md §2).
export const BCRYPT_COST = 12;

// Las 12 letras de grupo del Mundial 2026 (A–L).
export const GROUP_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const;
export type GroupLetter = (typeof GROUP_LETTERS)[number];

// Conteos esperados del catálogo del torneo, usados por el seed y su verificación.
export const TEAMS_COUNT = 48;
export const MATCHES_TOTAL = 104;
export const MATCHES_GROUP_STAGE = 72;
export const MATCHES_KNOCKOUT = 32;
