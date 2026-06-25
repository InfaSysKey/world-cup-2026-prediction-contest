// Derivación de los campos `matches.real_*` a partir del `score` de un partido
// de openfootball. Función pura: entra el entry de openfootball + el partido de
// BD, sale la actualización a aplicar (o null si el partido aún no se da por
// finalizado).
//
// Reglas de scoring v2.1 (scoring-rules.md §3.1/§3.3):
//
//   - Grupos: `real_goles_local/visitante` = score.ft. real_winner_team_code se
//     deriva con `computeGroupWinner` (3 valores: local, away, null si empate).
//   - Knockouts: `real_goles_local/visitante` = score.et si presente; si no,
//     score.ft (knockouts sin prórroga, decididos en 90'). real_winner_team_code
//     es quien tiene más goles a los 120'; en empate al 120' se decide por
//     score.p (penaltis). Sin score.p y empate al 120' → null y skip (resultado
//     incompleto en openfootball).
//
// Si openfootball trae el partido SIN score (aún no jugado), devuelve null.

import { computeGroupWinner } from '@/lib/matches/compute-winner';

import type { Phase } from '@/lib/db';
import type { OpenfootballMatch } from './openfootball-schema';

export type ScoreUpdate = {
  golesLocal: number;
  golesVisitante: number;
  // null en grupos cuando el partido acaba en empate. Para knockouts SIEMPRE
  // hay ganador (FIFA juega prórroga + penaltis). Si no se puede determinar
  // por la información de openfootball, se devuelve { kind: 'skipped' }.
  winnerTeamCode: string | null;
};

export type ApplyScoreResult =
  | { kind: 'applied'; update: ScoreUpdate }
  | { kind: 'no-score' } // partido aún no jugado en openfootball
  | { kind: 'skipped'; reason: SkipReason; detail?: string };

export type SkipReason =
  // Knockout que empata al 120' sin score.p (no podemos determinar ganador).
  | 'KNOCKOUT_TIE_NO_PENALTIES'
  // Knockout cuyo home/away (ya resuelto en BD) no coincide ni en orden directo
  // ni invertido con el entry de openfootball — sanity check.
  | 'TEAMS_MISMATCH';

export type DbMatchSubset = {
  phase: Phase;
  homeTeamCode: string;
  awayTeamCode: string;
};

// Devuelve la pareja [goles_local_en_BD, goles_visitante_en_BD] a partir de la
// pareja [team1, team2] de openfootball, normalizando al orden home/away del
// match en BD. Lanza si los códigos no coinciden con el match.
function alignToDbOrder(
  pair: readonly [number, number],
  entryHomeCode: string,
  entryAwayCode: string,
  match: DbMatchSubset,
): [number, number] | null {
  if (
    entryHomeCode === match.homeTeamCode &&
    entryAwayCode === match.awayTeamCode
  ) {
    return [pair[0], pair[1]];
  }
  if (
    entryHomeCode === match.awayTeamCode &&
    entryAwayCode === match.homeTeamCode
  ) {
    return [pair[1], pair[0]];
  }
  return null;
}

export function computeScoreUpdate(
  entry: OpenfootballMatch,
  match: DbMatchSubset,
  entryHomeCode: string,
  entryAwayCode: string,
): ApplyScoreResult {
  if (!entry.score) {
    return { kind: 'no-score' };
  }

  if (match.phase === 'grupos') {
    if (!entry.score.ft) {
      return { kind: 'no-score' };
    }
    const aligned = alignToDbOrder(
      entry.score.ft,
      entryHomeCode,
      entryAwayCode,
      match,
    );
    if (!aligned) {
      return { kind: 'skipped', reason: 'TEAMS_MISMATCH' };
    }
    const [gl, gv] = aligned;
    const winner = computeGroupWinner(
      match.homeTeamCode,
      match.awayTeamCode,
      gl,
      gv,
    );
    return {
      kind: 'applied',
      update: { golesLocal: gl, golesVisitante: gv, winnerTeamCode: winner },
    };
  }

  // Knockouts: el "marcador al 120'" es score.et si presente, si no score.ft.
  const referenceScore = entry.score.et ?? entry.score.ft;
  if (!referenceScore) {
    return { kind: 'no-score' };
  }
  const aligned = alignToDbOrder(
    referenceScore,
    entryHomeCode,
    entryAwayCode,
    match,
  );
  if (!aligned) {
    return { kind: 'skipped', reason: 'TEAMS_MISMATCH' };
  }
  const [gl, gv] = aligned;
  if (gl > gv) {
    return {
      kind: 'applied',
      update: {
        golesLocal: gl,
        golesVisitante: gv,
        winnerTeamCode: match.homeTeamCode,
      },
    };
  }
  if (gv > gl) {
    return {
      kind: 'applied',
      update: {
        golesLocal: gl,
        golesVisitante: gv,
        winnerTeamCode: match.awayTeamCode,
      },
    };
  }
  // Empate al 120' → ganador por penaltis. Si no hay score.p, no podemos
  // determinarlo y skipeamos (el admin lo cerrará a mano).
  if (!entry.score.p) {
    return { kind: 'skipped', reason: 'KNOCKOUT_TIE_NO_PENALTIES' };
  }
  const pAligned = alignToDbOrder(
    entry.score.p,
    entryHomeCode,
    entryAwayCode,
    match,
  );
  if (!pAligned) {
    return { kind: 'skipped', reason: 'TEAMS_MISMATCH' };
  }
  const [pl, pv] = pAligned;
  return {
    kind: 'applied',
    update: {
      golesLocal: gl,
      golesVisitante: gv,
      winnerTeamCode:
        pl > pv ? match.homeTeamCode : match.awayTeamCode,
    },
  };
}
