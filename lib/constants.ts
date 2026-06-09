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

// --- Formulario de porra (Slice 4) ---

// Tabs del stepper de la porra, en orden de navegación. Cada tab mapea a una o
// varias categorías de predicción (ver skill add-prediction-type). El usuario
// puede saltar libremente entre tabs; este array solo fija etiquetas y orden.
export const PORRA_TABS = [
  { id: 'grupos', label: 'Grupos' },
  { id: 'mejores-terceros', label: 'Mejores Terceros' },
  { id: 'dieciseisavos', label: '1/16' },
  { id: 'octavos', label: '1/8' },
  { id: 'cuartos', label: 'Cuartos' },
  { id: 'semis', label: 'Semis' },
  { id: 'tercer-puesto', label: '3.º y 4.º' },
  { id: 'final', label: 'Final' },
  { id: 'podio', label: 'Podio' },
  { id: 'premios', label: 'Premios' },
] as const;
export type PorraTabId = (typeof PORRA_TABS)[number]['id'];

// Número de mejores terceros que clasifican a 1/16 (scoring-rules.md §2.4).
export const BEST_THIRDS_COUNT = 8;

// Qué fase de eliminatorias representa cada tab del bracket en el stepper. El
// stepper tiene un tab por ronda; la fase (valor de matches.phase) es la clave
// para filtrar los cruces de resolve-bracket. Mantener en sync con PORRA_TABS.
export const BRACKET_TAB_PHASE = {
  dieciseisavos: '1/16',
  octavos: '1/8',
  cuartos: 'cuartos',
  semis: 'semi',
  'tercer-puesto': '3-4',
  final: 'final',
} as const;
export type BracketTabId = keyof typeof BRACKET_TAB_PHASE;

// Nº de cruces por fase eliminatoria (seed/matches.ts), para los indicadores de
// completitud de cada tab del bracket.
export const KNOCKOUT_MATCHES_PER_PHASE = {
  '1/16': 16,
  '1/8': 8,
  cuartos: 4,
  semi: 2,
  '3-4': 1,
  final: 1,
} as const;

// Debounce del autosave del formulario (skill add-prediction-type).
export const AUTOSAVE_DEBOUNCE_MS = 800;
