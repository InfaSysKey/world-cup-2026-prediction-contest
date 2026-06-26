// openfootball/worldcup.json, antes de que se resuelva el bracket, usa
// placeholders en los campos team1/team2 de las eliminatorias para indicar
// "el equipo de este slot aún no se sabe". Los formatos observados:
//
//   "1A", "1B", …, "1L"          → 1.º de grupo X
//   "2A", "2B", …, "2L"          → 2.º de grupo X
//   "3A/B/C/D/F"                  → mejor tercero cuyo grupo esté en {A,B,C,D,F}
//   "W73", "L101"                 → ganador/perdedor del match NN
//
// Estos no son nombres de equipo y por tanto no se deben reportar como
// UNKNOWN_TEAM_NAME (sería ruido constante en cada ejecución del cron). El
// importer los trata como BRACKET_PENDING, que el orquestador ya silencia.

const STANDING_POSITION_RE = /^[12][A-L]$/;
const BEST_THIRD_RE = /^3[A-L](\/[A-L])+$/;
const WINNER_LOSER_RE = /^[WL]\d{1,3}$/;

export function looksLikeOpenfootballPlaceholder(name: string): boolean {
  const trimmed = name.trim();
  return (
    STANDING_POSITION_RE.test(trimmed) ||
    BEST_THIRD_RE.test(trimmed) ||
    WINNER_LOSER_RE.test(trimmed)
  );
}
