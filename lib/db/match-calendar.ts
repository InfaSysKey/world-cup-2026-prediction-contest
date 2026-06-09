import { asc, eq } from 'drizzle-orm';

import {
  db,
  matches,
  predictionsGroupMatches,
  predictionsKnockout,
  type Phase,
} from '@/lib/db';
import { loadTeamsMap, type TeamInfo } from '@/lib/db/teams-map';
import { scoreGroupMatch } from '@/lib/scoring/group-matches';
import { scoreKnockoutMatch, type KnockoutPhase } from '@/lib/scoring/knockout';

// Calendario de los 104 partidos con el resultado oficial, MI predicción y los
// puntos que saqué en cada uno. Lee BD y reutiliza las funciones PURAS de scoring
// (group-matches, knockout) para los puntos por partido; no recalcula la tabla.

export type CalendarMatch = {
  id: number;
  phase: Phase;
  jornada: string | null;
  groupLetter: string | null;
  scheduledAt: Date;
  status: string;
  home: string;
  away: string;
  // Resultado oficial: "2 - 1" en grupos, nombre del ganador en eliminatorias.
  officialResult: string | null;
  // Mi predicción, en el mismo formato que officialResult.
  myPrediction: string | null;
  // Puntos que saqué; null si el partido aún no tiene resultado oficial.
  points: number | null;
};

function teamRef(
  teams: ReadonlyMap<string, TeamInfo>,
  teamCode: string | null,
  slotRef: string | null,
): string {
  if (teamCode) {
    const team = teams.get(teamCode);
    if (team) {
      return `${team.flag} ${team.name}`;
    }
    return teamCode;
  }
  return slotRef ?? '—';
}

function isKnockoutPhase(phase: Phase): phase is KnockoutPhase {
  return phase !== 'grupos';
}

export async function loadMatchCalendar(
  userId: number,
): Promise<CalendarMatch[]> {
  const [rows, gmPreds, koPreds, teams] = await Promise.all([
    db
      .select({
        id: matches.id,
        phase: matches.phase,
        jornada: matches.jornada,
        groupLetter: matches.groupLetter,
        scheduledAt: matches.scheduledAt,
        status: matches.status,
        homeTeamCode: matches.homeTeamCode,
        awayTeamCode: matches.awayTeamCode,
        homeSlotRef: matches.homeSlotRef,
        awaySlotRef: matches.awaySlotRef,
        realGolesLocal: matches.realGolesLocal,
        realGolesVisitante: matches.realGolesVisitante,
        realWinnerTeamCode: matches.realWinnerTeamCode,
      })
      .from(matches)
      .orderBy(asc(matches.scheduledAt), asc(matches.id)),
    db
      .select({
        matchId: predictionsGroupMatches.matchId,
        golesLocal: predictionsGroupMatches.golesLocal,
        golesVisitante: predictionsGroupMatches.golesVisitante,
      })
      .from(predictionsGroupMatches)
      .where(eq(predictionsGroupMatches.userId, userId)),
    db
      .select({
        matchId: predictionsKnockout.matchId,
        winnerTeamCode: predictionsKnockout.winnerTeamCode,
      })
      .from(predictionsKnockout)
      .where(eq(predictionsKnockout.userId, userId)),
    loadTeamsMap(),
  ]);

  const gmByMatch = new Map(gmPreds.map((p) => [p.matchId, p]));
  const koByMatch = new Map(koPreds.map((p) => [p.matchId, p.winnerTeamCode]));

  return rows.map((m): CalendarMatch => {
    const home = teamRef(teams, m.homeTeamCode, m.homeSlotRef);
    const away = teamRef(teams, m.awayTeamCode, m.awaySlotRef);
    const cancelled = m.status === 'cancelled';

    if (isKnockoutPhase(m.phase)) {
      const pick = koByMatch.get(m.id) ?? null;
      const myPrediction = pick ? teamRef(teams, pick, null) : null;
      const officialResult = m.realWinnerTeamCode
        ? teamRef(teams, m.realWinnerTeamCode, null)
        : null;
      const points =
        m.realWinnerTeamCode !== null
          ? scoreKnockoutMatch(pick, {
              phase: m.phase,
              realWinnerTeamCode: m.realWinnerTeamCode,
              cancelled,
            }).points
          : null;
      return {
        id: m.id,
        phase: m.phase,
        jornada: m.jornada,
        groupLetter: m.groupLetter,
        scheduledAt: m.scheduledAt,
        status: m.status,
        home,
        away,
        officialResult,
        myPrediction,
        points,
      };
    }

    // Fase de grupos: marcador.
    const pred = gmByMatch.get(m.id) ?? null;
    const myPrediction = pred
      ? `${pred.golesLocal} - ${pred.golesVisitante}`
      : null;
    const hasOfficial =
      m.realGolesLocal !== null && m.realGolesVisitante !== null;
    const officialResult = hasOfficial
      ? `${m.realGolesLocal} - ${m.realGolesVisitante}`
      : null;
    const points = hasOfficial
      ? scoreGroupMatch(pred, {
          golesLocal: m.realGolesLocal!,
          golesVisitante: m.realGolesVisitante!,
          cancelled,
        }).points
      : null;

    return {
      id: m.id,
      phase: m.phase,
      jornada: m.jornada,
      groupLetter: m.groupLetter,
      scheduledAt: m.scheduledAt,
      status: m.status,
      home,
      away,
      officialResult,
      myPrediction,
      points,
    };
  });
}
