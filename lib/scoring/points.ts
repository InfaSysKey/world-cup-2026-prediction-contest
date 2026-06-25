// Valores de puntos canónicos de scoring-rules.md §3 (v2.2). Source of truth única
// del motor de puntuación: cualquier cambio aquí exige actualizar la doc, abrir un
// ADR y bumpear scoring-rules.md (CLAUDE.md §10.10, ADR 0009/0010/0012).
//
// La regla "Diferencia/Distancia de goles con 1X2 acertado" aparece en el Excel
// con 0 pts (regla listada pero desactivada por el organizador) y por tanto no se
// implementa en código.
//
// Importante (ADR 0012): el Excel canónico ACUMULA los puntos por línea. Para
// un marcador exacto, el jugador recibe 3 (signo) + 0 (diferencia) + 5 (exacto)
// = 8 pts. Por eso `exact` vale 8 (no 5) y `result` mantiene su valor 3 cuando
// solo se acierta el signo. Modelamos esto como "exact O result O wrong"
// excluyentes y dejamos que el valor 8 absorba el sumatorio.

// §3.1 — marcadores de fase de grupos.
//   - Marcador exacto (signo 1X2 acertado + marcador exacto)  → 3 + 5 = 8
//   - Acierto del signo 1X2 sin marcador exacto                → 3
//   - Signo 1X2 fallado (incluida predicción vacía)            → 0
export const GROUP_MATCH_POINTS = {
  exact: 8,
  result: 3, // signo 1X2 acertado, marcador no exacto
  wrong: 0,
} as const;

// §3.2 — clasificación de cada grupo. Sin bonus por orden completo (el Excel
// canónico no lo lista). Indexados por posición-1: 1.º=2, 2.º=2, 3.º=2, 4.º=2.
// Máximo por grupo = 8; total 12 grupos = 96 pts. Ver ADR 0010 (corrección de
// 2/2/1/1 a 2/2/2/2 tras revisión directa del Excel del organizador).
export const GROUP_STANDING_POSITION_POINTS = [2, 2, 2, 2] as const;

// §3.3 — cruces eliminatorios. Mismo esquema que §3.1, aplicado al marcador al
// 120' (90'+prórroga, sin penaltis). Máximo = 32 × 8 = 256 pts. ADR 0012.
export const KNOCKOUT_MATCH_POINTS = {
  exact: 8,
  result: 3, // signo 1X2 al 120' acertado
  wrong: 0,
} as const;

// §3.4 — equipos clasificados por fase. 2 pts × equipo predicho que efectivamente
// llega a esa fase. Hay 6 fases (1/16, octavos, cuartos, semis, 3-4, final) con
// 32+16+8+4+2+2 = 64 aciertos potenciales → máximo 128 pts.
export const TEAM_ADVANCEMENT_POINTS_PER_TEAM = 2;

// §3.5 — cuadro de honor (podio). Adicionales a los de §3.3/§3.4 (simbólico).
// Máximo = 60 pts.
export const PODIUM_POINTS = {
  champion: 30,
  runner_up: 20,
  third: 10,
} as const;

// §3.6 — premios individuales (botas y balones). Máximo = 44 pts.
export const AWARD_POINTS = {
  boot_gold: 10,
  boot_silver: 7,
  boot_bronze: 5,
  ball_gold: 10,
  ball_silver: 7,
  ball_bronze: 5,
} as const;
