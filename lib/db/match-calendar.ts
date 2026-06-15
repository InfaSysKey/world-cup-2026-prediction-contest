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
import { scoreKnockoutMatch } from '@/lib/scoring/knockout';

// Calendario de los 104 partidos con el resultado oficial, MI predicción y los
// puntos que saqué en cada uno. Lee BD y reutiliza las funciones PURAS de
// scoring (group-matches, knockout) para los puntos por partido; no recalcula
// la tabla. Los 2 pts de "Equipo clasificado para X" (team_advancement) son
// una categoría global y NO se reflejan aquí: solo aparecen los 0/3/5 del
// marcador.

// Equipo de un lado del partido: nombre + código de bandera. flagCode null cuando
// el lado aún no está resuelto (slot simbólico, p. ej. "Ganador del cruce 49").
export type TeamRef = { name: string; flagCode: string | null };

export type CalendarMatch = {
  id: number;
  phase: Phase;
  jornada: string | null;
  groupLetter: string | null;
  scheduledAt: Date;
  status: string;
  home: TeamRef;
  away: TeamRef;
  // Resultado oficial mostrable: "2 - 1" en grupos; en knockouts "2 - 2
  // (Brasil)" cuando hay marcador y ganador, o solo el ganador si todavía no
  // hay marcador.
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
): TeamRef {
  if (teamCode) {
    const team = teams.get(teamCode);
    if (team) {
      return { name: team.name, flagCode: team.flagCode };
    }
    return { name: teamCode, flagCode: null };
  }
  return { name: slotRef ?? '—', flagCode: null };
}

// Solo el nombre (sin bandera), para los displays de ganador.
function teamName(
  teams: ReadonlyMap<string, TeamInfo>,
  teamCode: string,
): string {
  return teams.get(teamCode)?.name ?? teamCode;
}

function formatKnockoutDisplay(
  teams: ReadonlyMap<string, TeamInfo>,
  golesLocal: number | null,
  golesVisitante: number | null,
  winnerCode: string | null,
): string | null {
  const hasScore = golesLocal !== null && golesVisitante !== null;
  const hasWinner = winnerCode !== null;
  if (!hasScore && !hasWinner) {
    return null;
  }
  const scorePart = hasScore ? `${golesLocal} - ${golesVisitante}` : null;
  const winnerPart = hasWinner ? teamName(teams, winnerCode) : null;
  if (scorePart && winnerPart) {
    return `${scorePart} (${winnerPart})`;
  }
  return scorePart ?? winnerPart;
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
        golesLocal: predictionsKnockout.golesLocal,
        golesVisitante: predictionsKnockout.golesVisitante,
      })
      .from(predictionsKnockout)
      .where(eq(predictionsKnockout.userId, userId)),
    loadTeamsMap(),
  ]);

  const gmByMatch = new Map(gmPreds.map((p) => [p.matchId, p]));
  const koByMatch = new Map(koPreds.map((p) => [p.matchId, p]));

  return rows.map((m): CalendarMatch => {
    const home = teamRef(teams, m.homeTeamCode, m.homeSlotRef);
    const away = teamRef(teams, m.awayTeamCode, m.awaySlotRef);
    const cancelled = m.status === 'cancelled';

    if (m.phase !== 'grupos') {
      const pick = koByMatch.get(m.id);
      const predGl = pick?.golesLocal ?? null;
      const predGv = pick?.golesVisitante ?? null;
      const prediction =
        predGl !== null && predGv !== null
          ? { golesLocal: predGl, golesVisitante: predGv }
          : null;
      const myPrediction = formatKnockoutDisplay(
        teams,
        predGl,
        predGv,
        pick?.winnerTeamCode ?? null,
      );
      const officialResult = formatKnockoutDisplay(
        teams,
        m.realGolesLocal,
        m.realGolesVisitante,
        m.realWinnerTeamCode,
      );
      const hasOfficialMarker =
        m.realGolesLocal !== null && m.realGolesVisitante !== null;
      const points = hasOfficialMarker
        ? scoreKnockoutMatch(prediction, {
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
