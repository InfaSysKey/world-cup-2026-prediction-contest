// Valores de puntos de scoring-rules.md §3 y §4. Source of truth única del motor
// de puntuación: cualquier cambio aquí exige actualizar la doc + abrir un ADR +
// bumpear la versión de scoring-rules.md (§10, CLAUDE.md §10.10).

// §3.1 — marcadores de fase de grupos (regla por outcome 1X2, ADR 0006).
export const GROUP_MATCH_POINTS = {
  exact: 5,
  result: 3,
  oneGoal: 1,
  wrong: 0,
} as const;

// §3.2 — clasificación de cada grupo. Puntos por posición acertada, indexados
// por posición-1 (1.º=4, 2.º=3, 3.º=2, 4.º=1) + bonus por clavar el orden de 4.
export const GROUP_STANDING_POSITION_POINTS = [4, 3, 2, 1] as const;
export const GROUP_STANDING_EXACT_BONUS = 5;

// §3.3 — mejores terceros. 3 por cada selección acertada entre los 8 reales
// (sin importar el orden interno) + bonus por clavar los 8 en orden exacto.
export const BEST_THIRD_HIT_POINTS = 3;
export const BEST_THIRDS_EXACT_BONUS = 5;

// §3.4 — bracket eliminatorio. Puntos por acertar el ganador de un cruce, por
// fase. Bracket RÍGIDO (ADR 0003): el acierto solo cuenta si el equipo predicho
// es el que realmente ganó ESE cruce.
export const KNOCKOUT_PHASE_POINTS = {
  '1/16': 4,
  '1/8': 6,
  cuartos: 10,
  semi: 15,
  '3-4': 12,
  final: 25,
} as const;

// §3.5 — cuadro de honor (podio). Puntos ADICIONALES a los del bracket (§3.5):
// no se solapan. Máx 40.
export const PODIUM_POINTS = {
  champion: 20,
  runner_up: 12,
  third: 8,
} as const;

// §3.6 — premios individuales (botas y balones). Máx 50.
export const AWARD_POINTS = {
  boot_gold: 15,
  boot_silver: 8,
  boot_bronze: 5,
  ball_gold: 12,
  ball_silver: 6,
  ball_bronze: 4,
} as const;

// §4 — penalización por cada predicción vacía en las categorías 3.1–3.3.
export const EMPTY_PREDICTION_PENALTY = -1;
