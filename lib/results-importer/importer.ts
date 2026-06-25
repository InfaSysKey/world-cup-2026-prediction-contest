// Orquestador del importer de openfootball. Es la única capa que toca BD del
// módulo `results-importer`: el resto son funciones puras. El flujo es
// iterativo porque las distintas piezas se alimentan unas a otras:
//
//   1. Aplicar marcadores: para cada entry de openfootball que coincida con un
//      `matches` cuyos teams ya están asignados, escribir real_*.
//   2. Auto-cerrar clasificaciones de grupo: si los 6 marcadores de un grupo
//      están escritos en BD, computar `actual_group_standings` con tie-breaks
//      FIFA (escribir solo los grupos sin bloques pendientes).
//   3. Auto-cerrar mejores terceros: si los 12 standings están cerrados,
//      computar `actual_best_thirds` (8 mejores) por pts/GD/GF.
//   4. Avanzar bracket: para cada knockout con home/away_slot_ref no resuelto,
//      mirar standings + best thirds + ganadores previos y llenar
//      home_team_code/away_team_code.
//   5. Volver a 1 (los knockouts recién resueltos ahora pueden recibir
//      marcadores en la siguiente pasada).
//
// El bucle se corta cuando una iteración no produce ningún cambio. Tope de
// seguridad: 8 iteraciones (rondas posibles: grupos→standings→best
// thirds→1/16→octavos→cuartos→semis→final).
//
// Modo dry-run: hace los cómputos sobre los mismos datos pero NO escribe BD.
// Devuelve el mismo informe estructurado para que el operador inspeccione.

import { and, eq, isNull, ne } from 'drizzle-orm';

import { BEST_THIRDS_COUNT, GROUP_LETTERS } from '@/lib/constants';
import {
  actualBestThirds,
  actualGroupStandings,
  db,
  matches,
  teams,
} from '@/lib/db';
import { logger } from '@/lib/logger';
import { recalculateAll } from '@/lib/scoring';

import { computeBracketUpdates, type KnockoutMatch } from './advance-bracket';
import { computeScoreUpdate, type DbMatchSubset } from './apply-scores';
import { fetchOpenfootball } from './fetch-openfootball';
import { rankByPointsGdGf, rankGroup } from './fifa-tiebreaks';
import {
  findMatchForEntry,
  indexMatchesByKey,
  type MatchRow,
  type SkipReason as MatchFinderSkipReason,
} from './match-finder';
import type { OpenfootballFile } from './openfootball-schema';
import { teamCodeFromOpenfootball } from './team-name-map';

import type { Phase } from '@/lib/db';

const MAX_ITERATIONS = 8;

export type ImporterReport = {
  // Marcadores.
  scoresApplied: number;
  scoresAlreadyUpToDate: number;
  scoresSkipped: Array<{
    matchHint: string;
    reason: string;
    detail?: string;
  }>;
  // Standings de grupos.
  groupStandingsClosed: string[];
  groupStandingsPending: Array<{ groupLetter: string; tied: string[][] }>;
  // Mejores terceros.
  bestThirdsClosed: boolean;
  bestThirdsPending: { reason: string; tied?: string[][] } | null;
  // Bracket.
  bracketAdvanced: number;
  bracketPending: number;
  // Recálculo.
  recalcPerformed: boolean;
  iterations: number;
};

export type ImporterOptions = {
  dryRun: boolean;
  adminUserId: number;
  reason: string;
  // Permite inyectar fetcher (tests).
  fetchOverride?: () => Promise<OpenfootballFile>;
};

const SKIP_REASON_LABELS: Record<MatchFinderSkipReason, string> = {
  UNKNOWN_TEAM_NAME: 'Nombre de equipo no reconocido',
  UNKNOWN_ROUND: 'Round no mapeado a fase',
  BRACKET_PENDING: 'Cruce knockout sin teams aún (bracket pendiente)',
  NO_MATCH_IN_DB: 'No existe match en BD para esa pareja',
};

export async function importResults(
  options: ImporterOptions,
): Promise<ImporterReport> {
  const data = options.fetchOverride
    ? await options.fetchOverride()
    : await fetchOpenfootball();

  const report: ImporterReport = {
    scoresApplied: 0,
    scoresAlreadyUpToDate: 0,
    scoresSkipped: [],
    groupStandingsClosed: [],
    groupStandingsPending: [],
    bestThirdsClosed: false,
    bestThirdsPending: null,
    bracketAdvanced: 0,
    bracketPending: 0,
    recalcPerformed: false,
    iterations: 0,
  };

  if (options.dryRun) {
    await runIterations(data, report, null);
    return report;
  }

  await db.transaction(async (tx) => {
    await runIterations(data, report, tx);
    // Recálculo total al final si hubo cambios — más simple y barato que
    // intentar recálculos selectivos cuando hay cambios en múltiples
    // categorías. recalculateAll es idempotente.
    const anyChanges =
      report.scoresApplied > 0 ||
      report.groupStandingsClosed.length > 0 ||
      report.bestThirdsClosed ||
      report.bracketAdvanced > 0;
    if (anyChanges) {
      await recalculateAll(options.adminUserId, options.reason);
      report.recalcPerformed = true;
    }
  });

  return report;
}

// Bucle iterativo. Si tx es null, NO escribe.
async function runIterations(
  data: OpenfootballFile,
  report: ImporterReport,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | null,
): Promise<void> {
  for (let iter = 1; iter <= MAX_ITERATIONS; iter += 1) {
    report.iterations = iter;
    const before = snapshotProgress(report);

    await iterApplyScores(data, report, tx);
    await iterAutoStandings(report, tx);
    await iterAutoBestThirds(report, tx);
    await iterAdvanceBracket(report, tx);

    if (sameSnapshot(before, snapshotProgress(report))) {
      return;
    }
  }
  logger.warn('importer: límite de iteraciones alcanzado', {
    iterations: MAX_ITERATIONS,
  });
}

function snapshotProgress(r: ImporterReport): string {
  return `${r.scoresApplied}|${r.groupStandingsClosed.length}|${r.bestThirdsClosed}|${r.bracketAdvanced}`;
}
function sameSnapshot(a: string, b: string): boolean {
  return a === b;
}

// === Paso 1: aplicar marcadores ===
async function iterApplyScores(
  data: OpenfootballFile,
  report: ImporterReport,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | null,
): Promise<void> {
  const exec = tx ?? db;
  const allMatches = await exec
    .select({
      id: matches.id,
      phase: matches.phase,
      homeTeamCode: matches.homeTeamCode,
      awayTeamCode: matches.awayTeamCode,
      realGolesLocal: matches.realGolesLocal,
      realGolesVisitante: matches.realGolesVisitante,
      realWinnerTeamCode: matches.realWinnerTeamCode,
    })
    .from(matches);
  const index = indexMatchesByKey(allMatches as ReadonlyArray<MatchRow>);

  for (const entry of data.matches) {
    const found = findMatchForEntry(entry, index);
    if (found.kind === 'skipped') {
      // Solo reportamos UNKNOWN_TEAM_NAME y UNKNOWN_ROUND como skips ruidosos.
      // BRACKET_PENDING es esperado en cada iteración y se silencia.
      if (
        found.reason !== 'BRACKET_PENDING' &&
        found.reason !== 'NO_MATCH_IN_DB'
      ) {
        report.scoresSkipped.push({
          matchHint: `${entry.team1} vs ${entry.team2} (${entry.round})`,
          reason: SKIP_REASON_LABELS[found.reason],
          detail: found.detail,
        });
      }
      continue;
    }
    const dbMatch = allMatches.find((m) => m.id === found.matchId);
    if (!dbMatch || !dbMatch.homeTeamCode || !dbMatch.awayTeamCode) {
      continue;
    }
    const dbMatchSubset: DbMatchSubset = {
      phase: dbMatch.phase,
      homeTeamCode: dbMatch.homeTeamCode,
      awayTeamCode: dbMatch.awayTeamCode,
    };
    const homeCode = teamCodeFromOpenfootball(entry.team1)!;
    const awayCode = teamCodeFromOpenfootball(entry.team2)!;
    const computed = computeScoreUpdate(entry, dbMatchSubset, homeCode, awayCode);
    if (computed.kind === 'no-score') {
      continue;
    }
    if (computed.kind === 'skipped') {
      report.scoresSkipped.push({
        matchHint: `${entry.team1} vs ${entry.team2} (${entry.round})`,
        reason: computed.reason,
        detail: computed.detail,
      });
      continue;
    }
    const update = computed.update;
    if (
      dbMatch.realGolesLocal === update.golesLocal &&
      dbMatch.realGolesVisitante === update.golesVisitante &&
      dbMatch.realWinnerTeamCode === update.winnerTeamCode
    ) {
      report.scoresAlreadyUpToDate += 1;
      continue;
    }
    if (tx) {
      await tx
        .update(matches)
        .set({
          realGolesLocal: update.golesLocal,
          realGolesVisitante: update.golesVisitante,
          realWinnerTeamCode: update.winnerTeamCode,
          status: 'finished',
        })
        .where(eq(matches.id, found.matchId));
    }
    report.scoresApplied += 1;
  }
}

// === Paso 2: auto-cerrar standings de grupos ===
async function iterAutoStandings(
  report: ImporterReport,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | null,
): Promise<void> {
  const exec = tx ?? db;
  const groupTeams = await exec
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams);
  const teamsByGroup = new Map<string, string[]>();
  for (const t of groupTeams) {
    const list = teamsByGroup.get(t.groupLetter) ?? [];
    list.push(t.code);
    teamsByGroup.set(t.groupLetter, list);
  }
  const groupMatches = await exec
    .select({
      homeTeamCode: matches.homeTeamCode,
      awayTeamCode: matches.awayTeamCode,
      realGolesLocal: matches.realGolesLocal,
      realGolesVisitante: matches.realGolesVisitante,
    })
    .from(matches)
    .where(eq(matches.phase, 'grupos' as Phase));
  const existingStandings = await exec
    .select({ groupLetter: actualGroupStandings.groupLetter })
    .from(actualGroupStandings);
  const closedGroups = new Set(existingStandings.map((s) => s.groupLetter));

  for (const groupLetter of GROUP_LETTERS) {
    if (closedGroups.has(groupLetter)) continue;
    const codes = teamsByGroup.get(groupLetter) ?? [];
    const groupMatchesData = groupMatches.filter(
      (m) =>
        m.homeTeamCode &&
        m.awayTeamCode &&
        codes.includes(m.homeTeamCode) &&
        codes.includes(m.awayTeamCode),
    );
    const allFinished = groupMatchesData.every(
      (m) => m.realGolesLocal !== null && m.realGolesVisitante !== null,
    );
    if (!allFinished || groupMatchesData.length < 6) continue;

    const ranking = rankGroup(
      codes,
      groupMatchesData.map((m) => ({
        homeCode: m.homeTeamCode!,
        awayCode: m.awayTeamCode!,
        golesLocal: m.realGolesLocal,
        golesVisitante: m.realGolesVisitante,
      })),
    );

    if (ranking.pendingTiebreak.length > 0) {
      report.groupStandingsPending.push({
        groupLetter,
        tied: ranking.pendingTiebreak,
      });
      continue;
    }
    if (tx) {
      for (let i = 0; i < ranking.ordered.length; i += 1) {
        await tx
          .insert(actualGroupStandings)
          .values({
            groupLetter,
            position: i + 1,
            teamCode: ranking.ordered[i],
          })
          .onConflictDoUpdate({
            target: [
              actualGroupStandings.groupLetter,
              actualGroupStandings.position,
            ],
            set: { teamCode: ranking.ordered[i], updatedAt: new Date() },
          });
      }
    }
    report.groupStandingsClosed.push(groupLetter);
  }
}

// === Paso 3: auto-cerrar mejores terceros ===
async function iterAutoBestThirds(
  report: ImporterReport,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | null,
): Promise<void> {
  const exec = tx ?? db;
  const existing = await exec
    .select({ position: actualBestThirds.position })
    .from(actualBestThirds);
  if (existing.length === BEST_THIRDS_COUNT) {
    report.bestThirdsClosed = true;
    return;
  }
  const standings = await exec
    .select({
      groupLetter: actualGroupStandings.groupLetter,
      position: actualGroupStandings.position,
      teamCode: actualGroupStandings.teamCode,
    })
    .from(actualGroupStandings);
  const groupsClosed = new Set(standings.map((s) => s.groupLetter));
  if (groupsClosed.size < GROUP_LETTERS.length) {
    report.bestThirdsPending = { reason: 'NOT_ALL_GROUPS_CLOSED' };
    return;
  }
  const thirds = standings.filter((s) => s.position === 3).map((s) => s.teamCode);
  // Recomputamos pts/GD/GF de cada tercero a partir de TODOS sus partidos
  // de grupo (tabla parcial: solo el equipo).
  const groupMatches = await exec
    .select({
      homeTeamCode: matches.homeTeamCode,
      awayTeamCode: matches.awayTeamCode,
      realGolesLocal: matches.realGolesLocal,
      realGolesVisitante: matches.realGolesVisitante,
    })
    .from(matches)
    .where(eq(matches.phase, 'grupos' as Phase));
  const standingsByTeam = thirds.map((code) =>
    computeTeamStandingFromMatches(code, groupMatches),
  );
  const ranking = rankByPointsGdGf(standingsByTeam);
  // FIFA toma los 8 primeros. Si entre los puestos 8.º y 9.º hay empate sin
  // criterios disponibles, marcamos como pendiente (el admin lo decide).
  const eighthCode = ranking.ordered[BEST_THIRDS_COUNT - 1];
  const ninthCode = ranking.ordered[BEST_THIRDS_COUNT];
  const blockCrossesCutoff = ranking.pendingTiebreak.find(
    (block) => block.includes(eighthCode) && block.includes(ninthCode),
  );
  if (blockCrossesCutoff) {
    report.bestThirdsPending = {
      reason: 'PENDING_TIEBREAK_CROSSING_CUTOFF',
      tied: [blockCrossesCutoff],
    };
    return;
  }
  const top8 = ranking.ordered.slice(0, BEST_THIRDS_COUNT);
  if (tx) {
    for (let i = 0; i < top8.length; i += 1) {
      await tx
        .insert(actualBestThirds)
        .values({ position: i + 1, teamCode: top8[i] })
        .onConflictDoUpdate({
          target: actualBestThirds.position,
          set: { teamCode: top8[i], updatedAt: new Date() },
        });
    }
  }
  report.bestThirdsClosed = true;
}

// === Paso 4: avanzar bracket ===
async function iterAdvanceBracket(
  report: ImporterReport,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | null,
): Promise<void> {
  const exec = tx ?? db;
  const allTeams = await exec
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams);
  const standings = await exec
    .select({
      groupLetter: actualGroupStandings.groupLetter,
      position: actualGroupStandings.position,
      teamCode: actualGroupStandings.teamCode,
    })
    .from(actualGroupStandings);
  const thirds = await exec
    .select({
      position: actualBestThirds.position,
      teamCode: actualBestThirds.teamCode,
    })
    .from(actualBestThirds);
  const knockouts = await exec
    .select({
      id: matches.id,
      phase: matches.phase,
      homeSlotRef: matches.homeSlotRef,
      awaySlotRef: matches.awaySlotRef,
      homeTeamCode: matches.homeTeamCode,
      awayTeamCode: matches.awayTeamCode,
      realWinnerTeamCode: matches.realWinnerTeamCode,
    })
    .from(matches)
    .where(ne(matches.phase, 'grupos' as Phase));

  const { updates, pending } = computeBracketUpdates(
    knockouts.map((m) => ({
      id: m.id,
      homeSlotRef: m.homeSlotRef,
      awaySlotRef: m.awaySlotRef,
      homeTeamCode: m.homeTeamCode,
      awayTeamCode: m.awayTeamCode,
      realWinnerTeamCode: m.realWinnerTeamCode,
    })) as KnockoutMatch[],
    {
      byGroupAndPosition: new Map(
        standings.map((s) => [`${s.groupLetter}|${s.position}`, s.teamCode]),
      ),
      bestThirdsByPosition: new Map(thirds.map((t) => [t.position, t.teamCode])),
      teamGroupByCode: new Map(allTeams.map((t) => [t.code, t.groupLetter])),
    },
  );

  if (tx) {
    for (const u of updates) {
      await tx
        .update(matches)
        .set({ homeTeamCode: u.homeTeamCode, awayTeamCode: u.awayTeamCode })
        .where(eq(matches.id, u.matchId));
    }
  }
  report.bracketAdvanced += updates.length;
  report.bracketPending = pending.length;
}

// Helper: standings de un equipo individual a partir de todos sus partidos
// de grupo. Usado en best thirds (no podemos llamar a computeGroupPoints con
// 12 equipos en mezcla, hay que recalcular por equipo).
function computeTeamStandingFromMatches(
  teamCode: string,
  matchRows: ReadonlyArray<{
    homeTeamCode: string | null;
    awayTeamCode: string | null;
    realGolesLocal: number | null;
    realGolesVisitante: number | null;
  }>,
): {
  teamCode: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  goalsAgainst: number;
} {
  let points = 0;
  let gf = 0;
  let ga = 0;
  for (const m of matchRows) {
    if (
      m.realGolesLocal === null ||
      m.realGolesVisitante === null ||
      !m.homeTeamCode ||
      !m.awayTeamCode
    ) {
      continue;
    }
    let scored: number | null = null;
    let conceded: number | null = null;
    if (m.homeTeamCode === teamCode) {
      scored = m.realGolesLocal;
      conceded = m.realGolesVisitante;
    } else if (m.awayTeamCode === teamCode) {
      scored = m.realGolesVisitante;
      conceded = m.realGolesLocal;
    }
    if (scored === null || conceded === null) continue;
    gf += scored;
    ga += conceded;
    if (scored > conceded) points += 3;
    else if (scored === conceded) points += 1;
  }
  return {
    teamCode,
    points,
    goalDifference: gf - ga,
    goalsFor: gf,
    goalsAgainst: ga,
  };
}

// Silencia warning de unused imports cuando el módulo se importa con
// tree-shaking agresivo en algún consumer.
void and;
void isNull;
