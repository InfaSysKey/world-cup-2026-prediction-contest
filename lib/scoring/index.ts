// Orquestador del motor de puntuación v2.0 (scoring-rules.md §9, ADR 0009). Es la
// ÚNICA capa que toca BD: carga las predicciones del usuario + los resultados
// oficiales, delega el cálculo en el núcleo PURO (compute.ts) y persiste el
// desglose en `scores` (una fila por categoría). Idempotente: dos ejecuciones
// dejan las mismas filas (mismos points + detail; `calculated_at` es metadato).

import { eq } from 'drizzle-orm';

import { BEST_THIRDS_COUNT, GROUP_LETTERS } from '@/lib/constants';
import {
  actualAwards,
  actualBestThirds,
  actualGroupStandings,
  db,
  matches,
  type Phase,
  predictionsAwards,
  predictionsBestThirds,
  predictionsGroupMatches,
  predictionsGroupStandings,
  predictionsKnockout,
  SCORE_CATEGORIES,
  scoreRecalculations,
  scores,
  teams,
  users,
  type ScoreCategory,
} from '@/lib/db';

import type { AwardKind, AwardOfficial, AwardPicks } from './awards';
import {
  affectedCategoriesFor,
  computeScoreRows,
  type ResultChange,
  type ScoreRow,
  type ScoringInputs,
} from './compute';
import type { PodiumKind, PodiumOfficial, PodiumPicks } from './podium';
import {
  extractRankingMetrics,
  snapshotPositions,
  type RankingPlayer,
} from './ranking';
import { resolveBracket, type ResolvedMatch } from './resolve-bracket';
import {
  TEAM_ADVANCEMENT_PHASES,
  type TeamAdvancementInputs,
  type TeamAdvancementPhase,
} from './team-advancement';

export { affectedCategoriesFor, computeScoreRows };
export type { ResultChange, ScoringInputs };

// Ejecutor de consultas: el cliente global o una transacción. Ambos exponen la
// misma API de Drizzle, así que las funciones de carga/persistencia sirven para
// las dos.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

function toAdvancementPhase(phase: Phase): TeamAdvancementPhase {
  if (phase === 'grupos') {
    throw new Error(`toAdvancementPhase recibió una fase de grupos: ${phase}`);
  }
  return phase;
}

const STANDING_POSITIONS = [1, 2, 3, 4] as const;
const AWARD_KINDS: readonly AwardKind[] = [
  'boot_gold',
  'boot_silver',
  'boot_bronze',
  'ball_gold',
  'ball_silver',
  'ball_bronze',
];

// --- Carga: BD → ScoringInputs ---

export async function loadScoringInputs(
  exec: Executor,
  userId: number,
): Promise<ScoringInputs> {
  const allMatches = await exec
    .select({
      id: matches.id,
      phase: matches.phase,
      status: matches.status,
      homeSlotRef: matches.homeSlotRef,
      awaySlotRef: matches.awaySlotRef,
      homeTeamCode: matches.homeTeamCode,
      awayTeamCode: matches.awayTeamCode,
      realGolesLocal: matches.realGolesLocal,
      realGolesVisitante: matches.realGolesVisitante,
      realWinnerTeamCode: matches.realWinnerTeamCode,
    })
    .from(matches);

  // Catálogo `teams` para el mapeo equipo→grupo que necesita resolveBracket.
  const allTeams = await exec
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams);

  // Secuencial a propósito: cuando `exec` es una transacción comparte un único
  // cliente pg, que no admite consultas en paralelo (revienta con "another command
  // already in progress"). Son consultas pequeñas y ≤15 usuarios, así que el coste
  // es despreciable.
  const gmPreds = await exec
    .select({
      matchId: predictionsGroupMatches.matchId,
      golesLocal: predictionsGroupMatches.golesLocal,
      golesVisitante: predictionsGroupMatches.golesVisitante,
    })
    .from(predictionsGroupMatches)
    .where(eq(predictionsGroupMatches.userId, userId));
  const gsPreds = await exec
    .select({
      groupLetter: predictionsGroupStandings.groupLetter,
      position: predictionsGroupStandings.position,
      teamCode: predictionsGroupStandings.teamCode,
    })
    .from(predictionsGroupStandings)
    .where(eq(predictionsGroupStandings.userId, userId));
  const btPreds = await exec
    .select({
      position: predictionsBestThirds.position,
      teamCode: predictionsBestThirds.teamCode,
    })
    .from(predictionsBestThirds)
    .where(eq(predictionsBestThirds.userId, userId));
  const koPreds = await exec
    .select({
      matchId: predictionsKnockout.matchId,
      winnerTeamCode: predictionsKnockout.winnerTeamCode,
      golesLocal: predictionsKnockout.golesLocal,
      golesVisitante: predictionsKnockout.golesVisitante,
    })
    .from(predictionsKnockout)
    .where(eq(predictionsKnockout.userId, userId));
  const awardPreds = await exec
    .select({
      kind: predictionsAwards.kind,
      teamCode: predictionsAwards.teamCode,
      playerName: predictionsAwards.playerName,
    })
    .from(predictionsAwards)
    .where(eq(predictionsAwards.userId, userId));
  const gsActual = await exec
    .select({
      groupLetter: actualGroupStandings.groupLetter,
      position: actualGroupStandings.position,
      teamCode: actualGroupStandings.teamCode,
    })
    .from(actualGroupStandings);
  const btActual = await exec
    .select({
      position: actualBestThirds.position,
      teamCode: actualBestThirds.teamCode,
    })
    .from(actualBestThirds);
  const awardsActual = await exec
    .select({
      kind: actualAwards.kind,
      teamCode: actualAwards.teamCode,
      playerName: actualAwards.playerName,
    })
    .from(actualAwards);

  // Índices para joins en memoria.
  const gmByMatch = new Map(gmPreds.map((p) => [p.matchId, p]));
  const gsByKey = new Map(
    gsPreds.map((p) => [`${p.groupLetter}:${p.position}`, p.teamCode]),
  );
  const koByMatch = new Map(koPreds.map((p) => [p.matchId, p]));
  const predAwardByKind = new Map(awardPreds.map((a) => [a.kind, a]));
  const actualGsByKey = new Map(
    gsActual.map((a) => [`${a.groupLetter}:${a.position}`, a.teamCode]),
  );
  const actualBtByPos = new Map(btActual.map((a) => [a.position, a.teamCode]));
  const actualAwardByKind = new Map(awardsActual.map((a) => [a.kind, a]));
  const teamGroup = new Map(allTeams.map((t) => [t.code, t.groupLetter]));

  // group_matches.
  const groupMatches = allMatches
    .filter((m) => m.phase === 'grupos')
    .map((m) => {
      const pred = gmByMatch.get(m.id);
      const official =
        m.realGolesLocal !== null && m.realGolesVisitante !== null
          ? {
              golesLocal: m.realGolesLocal,
              golesVisitante: m.realGolesVisitante,
            }
          : null;
      return {
        matchId: m.id,
        cancelled: m.status === 'cancelled',
        official,
        prediction: pred
          ? { golesLocal: pred.golesLocal, golesVisitante: pred.golesVisitante }
          : null,
      };
    });

  // groups (los 12 siempre, para contar huecos aunque el usuario no prediga).
  const groups = GROUP_LETTERS.map((groupLetter) => {
    const predicted = STANDING_POSITIONS.map(
      (pos) => gsByKey.get(`${groupLetter}:${pos}`) ?? null,
    );
    const officialCodes = STANDING_POSITIONS.map(
      (pos) => actualGsByKey.get(`${groupLetter}:${pos}`) ?? null,
    );
    const official = officialCodes.every((c) => c !== null)
      ? officialCodes.filter((c): c is string => c !== null)
      : null;
    return { groupLetter, official, predicted };
  });

  // knockout markers: marcador predicho/oficial por cruce.
  const knockoutMatchesRaw = allMatches.filter((m) => m.phase !== 'grupos');
  const knockoutMarkers = knockoutMatchesRaw.map((m) => {
    const pred = koByMatch.get(m.id);
    const predGl = pred?.golesLocal;
    const predGv = pred?.golesVisitante;
    const prediction =
      predGl !== null && predGl !== undefined && predGv !== null && predGv !== undefined
        ? { golesLocal: predGl, golesVisitante: predGv }
        : null;
    const official =
      m.realGolesLocal !== null && m.realGolesVisitante !== null
        ? { golesLocal: m.realGolesLocal, golesVisitante: m.realGolesVisitante }
        : null;
    return {
      matchId: m.id,
      phase: toAdvancementPhase(m.phase),
      cancelled: m.status === 'cancelled',
      official,
      prediction,
    };
  });

  // teamAdvancement: equipos predichos y reales por cada una de las 6 fases.
  const teamAdvancement = buildTeamAdvancementInputs({
    knockoutMatches: knockoutMatchesRaw,
    standings: gsPreds,
    bestThirds: btPreds,
    knockoutPicks: koPreds.map((p) => ({
      matchId: p.matchId,
      winnerTeamCode: p.winnerTeamCode,
    })),
    teamGroup,
    actualGsByKey,
    actualBtByPos,
  });

  // podium (team_code) y awards (player_name).
  const podiumPicks = buildPodium((kind) => predAwardByKind.get(kind)?.teamCode);
  const podiumOfficial = buildPodium(
    (kind) => actualAwardByKind.get(kind)?.teamCode,
  );
  const awardPicksRec = buildAwards(
    (kind) => predAwardByKind.get(kind)?.playerName,
  );
  const awardOfficialRec = buildAwards(
    (kind) => actualAwardByKind.get(kind)?.playerName,
  );

  return {
    groupMatches,
    groups,
    knockoutMarkers,
    teamAdvancement,
    podium: { picks: podiumPicks, official: podiumOfficial },
    awards: { picks: awardPicksRec, official: awardOfficialRec },
  };
}

// --- Derivación de los inputs de team_advancement ---

type AdvancementSources = {
  knockoutMatches: ReadonlyArray<{
    id: number;
    phase: Phase;
    homeSlotRef: string | null;
    awaySlotRef: string | null;
    homeTeamCode: string | null;
    awayTeamCode: string | null;
    realWinnerTeamCode: string | null;
  }>;
  standings: ReadonlyArray<{
    groupLetter: string;
    position: number;
    teamCode: string;
  }>;
  bestThirds: ReadonlyArray<{ position: number; teamCode: string }>;
  knockoutPicks: ReadonlyArray<{ matchId: number; winnerTeamCode: string }>;
  teamGroup: ReadonlyMap<string, string>;
  actualGsByKey: ReadonlyMap<string, string>;
  actualBtByPos: ReadonlyMap<number, string>;
};

const PHASE_COUNTS: Record<TeamAdvancementPhase, number> = {
  '1/16': 32,
  '1/8': 16,
  cuartos: 8,
  semi: 4,
  '3-4': 2,
  final: 2,
};

const SOURCE_PHASE: Partial<Record<TeamAdvancementPhase, TeamAdvancementPhase>> =
  {
    '1/8': '1/16',
    cuartos: '1/8',
    semi: 'cuartos',
    final: 'semi',
  };

function buildTeamAdvancementInputs(
  s: AdvancementSources,
): TeamAdvancementInputs {
  // Resuelve el bracket del usuario para conocer los 2 equipos predichos en cada
  // cruce (necesario para derivar perdedores de semis = predicted '3-4').
  const resolvedMap = resolveBracket({
    matches: s.knockoutMatches
      .filter((m) => m.homeSlotRef !== null && m.awaySlotRef !== null)
      .map((m) => ({
        id: m.id,
        phase: m.phase,
        homeSlotRef: m.homeSlotRef as string,
        awaySlotRef: m.awaySlotRef as string,
      })),
    standings: s.standings,
    bestThirds: s.bestThirds,
    knockout: s.knockoutPicks,
    teamGroup: s.teamGroup,
  });

  const matchesByPhase = new Map<Phase, number[]>();
  for (const m of s.knockoutMatches) {
    const list = matchesByPhase.get(m.phase) ?? [];
    list.push(m.id);
    matchesByPhase.set(m.phase, list);
  }

  // ---- predicted ----
  const predicted: TeamAdvancementInputs['predicted'] = {
    '1/16': predictedRoundOf32(s),
    '1/8': pickedWinnersInPhase(matchesByPhase.get('1/16') ?? [], resolvedMap),
    cuartos: pickedWinnersInPhase(matchesByPhase.get('1/8') ?? [], resolvedMap),
    semi: pickedWinnersInPhase(
      matchesByPhase.get('cuartos') ?? [],
      resolvedMap,
    ),
    '3-4': predictedLosersInPhase(
      matchesByPhase.get('semi') ?? [],
      resolvedMap,
    ),
    final: pickedWinnersInPhase(matchesByPhase.get('semi') ?? [], resolvedMap),
  };

  // ---- actual ----
  const actual: TeamAdvancementInputs['actual'] = {
    '1/16': actualRoundOf32(s),
    '1/8': actualWinnersInPhase(s.knockoutMatches, '1/16'),
    cuartos: actualWinnersInPhase(s.knockoutMatches, '1/8'),
    semi: actualWinnersInPhase(s.knockoutMatches, 'cuartos'),
    '3-4': actualLosersInSemis(s.knockoutMatches),
    final: actualWinnersInPhase(s.knockoutMatches, 'semi'),
  };

  // Si un set de actual no tiene el tamaño esperado, todavía no está cerrada esa
  // fase: marca como null para que team_advancement la trate como "pendiente".
  for (const phase of TEAM_ADVANCEMENT_PHASES) {
    const list = actual[phase];
    if (list !== null && list.length !== PHASE_COUNTS[phase]) {
      actual[phase] = null;
    }
  }
  // Silencia el warning de TS: source phase aún no usado tras simplificar derivación.
  void SOURCE_PHASE;

  return { predicted, actual };
}

function predictedRoundOf32(s: AdvancementSources): string[] {
  const result: string[] = [];
  for (const st of s.standings) {
    if (st.position === 1 || st.position === 2) {
      result.push(st.teamCode);
    }
  }
  for (const b of s.bestThirds) {
    result.push(b.teamCode);
  }
  return result;
}

function actualRoundOf32(s: AdvancementSources): string[] | null {
  const codes: string[] = [];
  for (const groupLetter of GROUP_LETTERS) {
    for (const pos of [1, 2] as const) {
      const code = s.actualGsByKey.get(`${groupLetter}:${pos}`);
      if (!code) {
        return null;
      }
      codes.push(code);
    }
  }
  for (let i = 1; i <= BEST_THIRDS_COUNT; i += 1) {
    const code = s.actualBtByPos.get(i);
    if (!code) {
      return null;
    }
    codes.push(code);
  }
  return codes;
}

function pickedWinnersInPhase(
  matchIds: readonly number[],
  resolvedMap: ReadonlyMap<number, ResolvedMatch>,
): string[] {
  const out: string[] = [];
  for (const id of matchIds) {
    const r = resolvedMap.get(id);
    if (r?.pickedWinner) {
      out.push(r.pickedWinner);
    }
  }
  return out;
}

function predictedLosersInPhase(
  matchIds: readonly number[],
  resolvedMap: ReadonlyMap<number, ResolvedMatch>,
): string[] {
  const out: string[] = [];
  for (const id of matchIds) {
    const r = resolvedMap.get(id);
    if (!r || !r.pickedWinner) {
      continue;
    }
    const home = r.home.teamCode;
    const away = r.away.teamCode;
    if (home && r.pickedWinner === home && away) {
      out.push(away);
    } else if (away && r.pickedWinner === away && home) {
      out.push(home);
    }
  }
  return out;
}

function actualWinnersInPhase(
  knockoutMatches: AdvancementSources['knockoutMatches'],
  phase: TeamAdvancementPhase,
): string[] {
  const winners: string[] = [];
  for (const m of knockoutMatches) {
    if (m.phase === phase && m.realWinnerTeamCode) {
      winners.push(m.realWinnerTeamCode);
    }
  }
  return winners;
}

function actualLosersInSemis(
  knockoutMatches: AdvancementSources['knockoutMatches'],
): string[] {
  const losers: string[] = [];
  for (const m of knockoutMatches) {
    if (m.phase !== 'semi' || !m.realWinnerTeamCode) {
      continue;
    }
    const home = m.homeTeamCode;
    const away = m.awayTeamCode;
    if (home && m.realWinnerTeamCode === home && away) {
      losers.push(away);
    } else if (away && m.realWinnerTeamCode === away && home) {
      losers.push(home);
    }
  }
  return losers;
}

function buildPodium(
  get: (kind: PodiumKind) => string | null | undefined,
): PodiumPicks & PodiumOfficial {
  return {
    champion: get('champion') ?? null,
    runner_up: get('runner_up') ?? null,
    third: get('third') ?? null,
  };
}

function buildAwards(
  get: (kind: AwardKind) => string | null | undefined,
): AwardPicks & AwardOfficial {
  const rec = {} as AwardPicks & AwardOfficial;
  for (const kind of AWARD_KINDS) {
    rec[kind] = get(kind) ?? null;
  }
  return rec;
}

// --- Persistencia: upsert idempotente, solo de las categorías indicadas ---

async function persistScoreRows(
  exec: Executor,
  userId: number,
  rows: readonly ScoreRow[],
  categories: readonly ScoreCategory[],
): Promise<void> {
  const wanted = new Set(categories);
  for (const row of rows) {
    if (!wanted.has(row.category)) {
      continue;
    }
    await exec
      .insert(scores)
      .values({
        userId,
        category: row.category,
        points: row.points,
        detail: row.detail,
      })
      .onConflictDoUpdate({
        target: [scores.userId, scores.category],
        set: { points: row.points, detail: row.detail, calculatedAt: new Date() },
      });
  }
}

// --- API pública del orquestador ---

// Recalcula y persiste las 6 categorías v2.0 de un usuario. Idempotente.
export async function calculateUserScore(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const inputs = await loadScoringInputs(tx, userId);
    const rows = computeScoreRows(inputs);
    await persistScoreRows(tx, userId, rows, SCORE_CATEGORIES);
  });
}

const CHANGE_REASON: Record<ResultChange['type'], string> = {
  group_match: 'Edición de marcador de fase de grupos',
  knockout: 'Edición de marcador/ganador de cruce eliminatorio',
  group_standings: 'Edición de la clasificación oficial de un grupo',
  best_thirds: 'Edición de los mejores terceros oficiales',
  award: 'Edición de un premio oficial (podio/botas/balones)',
};

// Recalcula SOLO las categorías afectadas por un cambio de resultado, para todos
// los usuarios, usando el ejecutor dado, y registra una fila de auditoría.
// Esta variante recibe la transacción para que el admin pueda hacer atómicos el
// guardado del resultado y su recálculo.
export async function recalculateAfterResultChangeWithTx(
  exec: Executor,
  change: ResultChange,
  adminUserId: number,
): Promise<void> {
  const categories = affectedCategoriesFor(change);
  const allUsers = await exec
    .select({
      id: users.id,
      nickname: users.nickname,
      isAdmin: users.isAdmin,
    })
    .from(users);
  // Para el snapshot de posiciones: el ranking (data-model §6.1) excluye admins.
  const players: RankingPlayer[] = [];
  for (const u of allUsers) {
    const inputs = await loadScoringInputs(exec, u.id);
    const rows = computeScoreRows(inputs);
    await persistScoreRows(exec, u.id, rows, categories);
    if (!u.isAdmin) {
      players.push({
        userId: u.id,
        nickname: u.nickname,
        metrics: extractRankingMetrics(rows),
      });
    }
  }
  await exec.insert(scoreRecalculations).values({
    triggeredBy: adminUserId,
    reason: CHANGE_REASON[change.type],
    affectedCategories: categories,
    usersAffected: allUsers.length,
    // Snapshot { userId: rank } para los deltas ▲/▼ del ranking (§5.5).
    positions: snapshotPositions(players),
  });
}

// Variante autónoma: abre su propia transacción. Útil para recálculos manuales
// fuera de una admin action.
export async function recalculateAfterResultChange(
  change: ResultChange,
  adminUserId: number,
): Promise<void> {
  await db.transaction((tx) =>
    recalculateAfterResultChangeWithTx(tx, change, adminUserId),
  );
}

// Recálculo TOTAL para todos los usuarios y todas las categorías v2.0. Se
// utiliza tras un cambio estructural del motor (p. ej. adopción de las reglas
// v2.0 del Excel canónico, ADR 0009): cambian las constantes, las categorías o
// el algoritmo, y todas las filas de `scores` previas dejan de ser válidas.
// Idempotente. Deja una única fila de auditoría con el motivo recibido y
// snapshot del ranking resultante.
export async function recalculateAll(
  adminUserId: number,
  reason: string,
): Promise<{ usersAffected: number }> {
  return db.transaction(async (tx) => {
    const allUsers = await tx
      .select({
        id: users.id,
        nickname: users.nickname,
        isAdmin: users.isAdmin,
      })
      .from(users);
    const players: RankingPlayer[] = [];
    for (const u of allUsers) {
      const inputs = await loadScoringInputs(tx, u.id);
      const rows = computeScoreRows(inputs);
      await persistScoreRows(tx, u.id, rows, SCORE_CATEGORIES);
      if (!u.isAdmin) {
        players.push({
          userId: u.id,
          nickname: u.nickname,
          metrics: extractRankingMetrics(rows),
        });
      }
    }
    await tx.insert(scoreRecalculations).values({
      triggeredBy: adminUserId,
      reason,
      affectedCategories: [...SCORE_CATEGORIES],
      usersAffected: allUsers.length,
      positions: snapshotPositions(players),
    });
    return { usersAffected: allUsers.length };
  });
}
