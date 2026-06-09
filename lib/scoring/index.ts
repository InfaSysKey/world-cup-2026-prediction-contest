// Orquestador del motor de puntuación (scoring-rules.md §9). Es la ÚNICA capa que
// toca BD: carga las predicciones del usuario + los resultados oficiales, delega
// el cálculo en el núcleo PURO (compute.ts) y persiste el desglose en `scores`
// (una fila por categoría). Idempotente: dos ejecuciones dejan las mismas filas
// (mismos points + detail; `calculated_at` es metadato).

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
import type { KnockoutPhase } from './knockout';
import type { PodiumKind, PodiumOfficial, PodiumPicks } from './podium';

export { affectedCategoriesFor, computeScoreRows };
export type { ResultChange, ScoringInputs };

// Ejecutor de consultas: el cliente global o una transacción. Ambos exponen la
// misma API de Drizzle, así que las funciones de carga/persistencia sirven para
// las dos.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// Estrecha Phase → KnockoutPhase por exclusión, sin `as`. Solo se llama sobre
// cruces ya filtrados (phase !== 'grupos'), así que la rama de error es inalcanzable.
function toKnockoutPhase(phase: Phase): KnockoutPhase {
  if (phase === 'grupos') {
    throw new Error(`toKnockoutPhase recibió una fase de grupos: ${phase}`);
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
      realGolesLocal: matches.realGolesLocal,
      realGolesVisitante: matches.realGolesVisitante,
      realWinnerTeamCode: matches.realWinnerTeamCode,
    })
    .from(matches);

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
  const btByPos = new Map(btPreds.map((p) => [p.position, p.teamCode]));
  const koByMatch = new Map(koPreds.map((p) => [p.matchId, p.winnerTeamCode]));
  const predAwardByKind = new Map(awardPreds.map((a) => [a.kind, a]));
  const actualGsByKey = new Map(
    gsActual.map((a) => [`${a.groupLetter}:${a.position}`, a.teamCode]),
  );
  const actualBtByPos = new Map(btActual.map((a) => [a.position, a.teamCode]));
  const actualAwardByKind = new Map(awardsActual.map((a) => [a.kind, a]));

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

  // best_thirds.
  const btPredicted = Array.from(
    { length: BEST_THIRDS_COUNT },
    (_, i) => btByPos.get(i + 1) ?? null,
  );
  const btOfficialCodes = Array.from(
    { length: BEST_THIRDS_COUNT },
    (_, i) => actualBtByPos.get(i + 1) ?? null,
  );
  const btOfficial = btOfficialCodes.every((c) => c !== null)
    ? btOfficialCodes.filter((c): c is string => c !== null)
    : null;

  // knockout.
  const knockout = allMatches
    .filter((m) => m.phase !== 'grupos')
    .map((m) => ({
      matchId: m.id,
      phase: toKnockoutPhase(m.phase),
      cancelled: m.status === 'cancelled',
      realWinnerTeamCode: m.realWinnerTeamCode ?? null,
      pick: koByMatch.get(m.id) ?? null,
    }));

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
    bestThirds: { official: btOfficial, predicted: btPredicted },
    knockout,
    podium: { picks: podiumPicks, official: podiumOfficial },
    awards: { picks: awardPicksRec, official: awardOfficialRec },
  };
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

// Recalcula y persiste las 7 categorías de un usuario. Idempotente.
export async function calculateUserScore(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const inputs = await loadScoringInputs(tx, userId);
    const rows = computeScoreRows(inputs);
    await persistScoreRows(tx, userId, rows, SCORE_CATEGORIES);
  });
}

const CHANGE_REASON: Record<ResultChange['type'], string> = {
  group_match: 'Edición de marcador de fase de grupos',
  knockout: 'Edición de ganador de cruce eliminatorio',
  group_standings: 'Edición de la clasificación oficial de un grupo',
  best_thirds: 'Edición de los mejores terceros oficiales',
  award: 'Edición de un premio oficial (podio/botas/balones)',
};

// Recalcula SOLO las categorías afectadas por un cambio de resultado, para todos
// los usuarios, usando el ejecutor dado, y registra una fila de auditoría. No
// toca `penalties` ni ninguna categoría no relacionada (recálculo selectivo §9).
// Esta variante recibe la transacción para que el admin pueda hacer atómicos el
// guardado del resultado y su recálculo.
export async function recalculateAfterResultChangeWithTx(
  exec: Executor,
  change: ResultChange,
  adminUserId: number,
): Promise<void> {
  const categories = affectedCategoriesFor(change);
  const allUsers = await exec.select({ id: users.id }).from(users);
  for (const u of allUsers) {
    const inputs = await loadScoringInputs(exec, u.id);
    const rows = computeScoreRows(inputs);
    await persistScoreRows(exec, u.id, rows, categories);
  }
  await exec.insert(scoreRecalculations).values({
    triggeredBy: adminUserId,
    reason: CHANGE_REASON[change.type],
    affectedCategories: categories,
    usersAffected: allUsers.length,
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
