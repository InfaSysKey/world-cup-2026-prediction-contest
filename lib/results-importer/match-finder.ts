// Asigna cada partido de openfootball a un registro de la tabla `matches` de
// nuestro esquema. La estrategia depende de la fase:
//
//   - Grupos: clave única (phase='grupos', home_team_code, away_team_code).
//     Los 72 partidos están sembrados con teams reales desde el seed.
//   - Knockouts: clave única (phase, home_team_code, away_team_code) UNA vez el
//     bracket está resuelto. Si los teams todavía no están asignados en
//     `matches` (campo NULL), el partido se skipea con motivo "bracket
//     pendiente". El orquestador es iterativo: tras resolver el bracket
//     vuelve a llamar al matcher.
//
// La función NO toca BD: recibe la lista de matches ya cargada como input y
// devuelve un id o null. Mantenemos pureza para test sin mock de drizzle.

import { looksLikeOpenfootballPlaceholder } from './openfootball-placeholders';
import { phaseFromOpenfootballRound } from './round-map';
import { teamCodeFromOpenfootball } from './team-name-map';

import type { Phase } from '@/lib/db';
import type { OpenfootballMatch } from './openfootball-schema';

export type MatchRow = {
  id: number;
  phase: Phase;
  homeTeamCode: string | null;
  awayTeamCode: string | null;
};

export type FindMatchResult =
  | { kind: 'matched'; matchId: number }
  | { kind: 'skipped'; reason: SkipReason; detail?: string };

export type SkipReason =
  | 'UNKNOWN_TEAM_NAME'
  | 'UNKNOWN_ROUND'
  | 'BRACKET_PENDING'
  | 'NO_MATCH_IN_DB';

// Localiza el partido de BD correspondiente a una entrada de openfootball.
// `matchesByKey` es un índice que el orquestador construye una vez por
// ejecución (clave: `${phase}|${homeCode}|${awayCode}`).
export function findMatchForEntry(
  entry: OpenfootballMatch,
  matchesByKey: ReadonlyMap<string, MatchRow>,
): FindMatchResult {
  const phase = phaseFromOpenfootballRound(entry.round);
  if (!phase) {
    return { kind: 'skipped', reason: 'UNKNOWN_ROUND', detail: entry.round };
  }
  const homeCode = teamCodeFromOpenfootball(entry.team1);
  const awayCode = teamCodeFromOpenfootball(entry.team2);
  if (!homeCode || !awayCode) {
    // openfootball, antes de que se resuelva el bracket, mete placeholders
    // ("1F", "3A/B/C/D/F", "W74") en team1/team2. NO son nombres de equipo y
    // los reportamos como BRACKET_PENDING (que el orquestador silencia) en
    // vez de UNKNOWN_TEAM_NAME (que ensucia el log del cron diario).
    if (
      looksLikeOpenfootballPlaceholder(entry.team1) ||
      looksLikeOpenfootballPlaceholder(entry.team2)
    ) {
      return { kind: 'skipped', reason: 'BRACKET_PENDING' };
    }
    return {
      kind: 'skipped',
      reason: 'UNKNOWN_TEAM_NAME',
      detail: `${entry.team1} vs ${entry.team2}`,
    };
  }

  // Probamos directo (team1=home, team2=away) y también orden invertido, por
  // si openfootball y nuestro seed difieren en quién es local — el seed
  // refleja la decisión FIFA del fixture, openfootball también, pero la
  // disciplina de ambos no garantiza el mismo orden en knockouts donde el
  // bracket aún se está resolviendo.
  const direct = matchesByKey.get(`${phase}|${homeCode}|${awayCode}`);
  if (direct) {
    return { kind: 'matched', matchId: direct.id };
  }
  const reversed = matchesByKey.get(`${phase}|${awayCode}|${homeCode}`);
  if (reversed) {
    return { kind: 'matched', matchId: reversed.id };
  }

  // Si los teams del entry son reconocibles pero NO existe match para esa fase
  // con esos teams, suele ser porque el bracket todavía no ha avanzado y el
  // partido knockout sigue con (home_team_code, away_team_code) = (NULL, NULL).
  // Distinguimos eso de "no hay partido para esa pareja en absoluto" mirando
  // si hay algún match de esa fase con uno de los dos teams asignado.
  if (phase !== 'grupos') {
    return { kind: 'skipped', reason: 'BRACKET_PENDING' };
  }
  return {
    kind: 'skipped',
    reason: 'NO_MATCH_IN_DB',
    detail: `${phase} ${homeCode} vs ${awayCode}`,
  };
}

// Construye el índice de matches por clave (phase, home, away). Solo incluye
// matches con ambos teams asignados (los knockouts pendientes quedan fuera).
export function indexMatchesByKey(
  rows: readonly MatchRow[],
): Map<string, MatchRow> {
  const out = new Map<string, MatchRow>();
  for (const m of rows) {
    if (m.homeTeamCode && m.awayTeamCode) {
      out.set(`${m.phase}|${m.homeTeamCode}|${m.awayTeamCode}`, m);
    }
  }
  return out;
}
