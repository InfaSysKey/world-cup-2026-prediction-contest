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

// --- Auth (CLAUDE.md §6, ADR 0002) ---

// Cookie de sesión: nombre y duración.
export const SESSION_COOKIE_NAME = 'porra_session';
export const SESSION_DURATION_DAYS = 30;

// Caducidad de los tokens de invitación.
export const INVITATION_EXPIRY_DAYS = 7;

// Bytes de entropía para tokens de sesión e invitación (base64url).
export const AUTH_TOKEN_BYTES = 32;

// Límites de longitud de contraseña. El máximo es el límite de bcrypt (72 bytes).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

// --- Resultados oficiales (Slice 3, scoring-rules.md §2-3) ---

// Tope de goles por equipo aceptado al introducir un marcador.
export const MAX_GOLES = 20;

// Premios del podio: se guardan por equipo (team_code). El resto de premios
// (botas/balones) se guardan por nombre de jugador (data-model.md §5.3).
export const PODIUM_AWARD_KINDS = ['champion', 'runner_up', 'third'] as const;
