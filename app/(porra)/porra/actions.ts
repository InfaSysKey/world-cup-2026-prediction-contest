'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/current-user';
import {
  db,
  matches,
  predictionsAwards,
  predictionsBestThirds,
  predictionsGroupMatches,
  predictionsGroupStandings,
  predictionsKnockout,
  teams,
} from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  isAwardsPredictionLocked,
  isBestThirdsLocked,
  isGroupMatchPredictionLocked,
  isGroupStandingsLocked,
  isKnockoutLocked,
} from '@/lib/scoring/locks';
import type { ApiResult } from '@/lib/types';
import {
  bestThirdsBatchSchema,
  groupMatchPredictionsBatchSchema,
  groupStandingsBatchSchema,
  knockoutPredictionSchema,
  playerAwardsPredictionSchema,
  podiumPredictionSchema,
} from '@/lib/validators/predictions';

// Server Actions del formulario de porra. Una acción por categoría de predicción.
// Estructura obligatoria (skill add-prediction-type §2):
//   1. Auth (userId SIEMPRE de la sesión, nunca del cliente).
//   2. Lock check antes de escribir.
//   3. Validar el input con Zod.
//   4. Upsert en BD (transacción si afecta a varias filas).
//   5. Devolver ApiResult<T>.

function internalError(): ApiResult<never> {
  return {
    error: { code: 'INTERNAL_ERROR', message: 'No se pudo guardar. Inténtalo de nuevo.' },
  };
}

// --- Marcadores de fase de grupos ---

export async function saveGroupMatchPredictions(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isGroupMatchPredictionLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = groupMatchPredictionsBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  if (parsed.data.length === 0) {
    return { data: { saved: 0 } };
  }

  // Solo se aceptan partidos de fase de grupos (no knockouts ni ids inventados).
  const groupMatchRows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.phase, 'grupos'));
  const groupMatchIds = new Set(groupMatchRows.map((m) => m.id));
  if (!parsed.data.every((p) => groupMatchIds.has(p.matchId))) {
    return { error: { code: 'INVALID_INPUT', message: 'Algún partido no es de fase de grupos.' } };
  }

  try {
    await db.transaction(async (tx) => {
      for (const p of parsed.data) {
        await tx
          .insert(predictionsGroupMatches)
          .values({
            userId: user.id,
            matchId: p.matchId,
            golesLocal: p.golesLocal,
            golesVisitante: p.golesVisitante,
          })
          .onConflictDoUpdate({
            target: [
              predictionsGroupMatches.userId,
              predictionsGroupMatches.matchId,
            ],
            set: {
              golesLocal: p.golesLocal,
              golesVisitante: p.golesVisitante,
              updatedAt: new Date(),
            },
          });
      }
    });
  } catch (err) {
    logger.error('saveGroupMatchPredictions failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: parsed.data.length } };
}

// --- Mejores terceros (predictions_best_thirds) ---

export async function saveBestThirdsPrediction(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isBestThirdsLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = bestThirdsBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }

  // Cada equipo debe existir en el catálogo. La coherencia "es 3.º de un grupo"
  // es warning (scoring-rules.md §2.4) y se permite guardar stale: la BD refleja
  // la decisión del usuario.
  const teamRows = await db.select({ code: teams.code }).from(teams);
  const knownCodes = new Set(teamRows.map((t) => t.code));
  if (!parsed.data.every((e) => knownCodes.has(e.teamCode))) {
    return {
      error: { code: 'INVALID_INPUT', message: 'Algún equipo no existe.' },
    };
  }

  // Reescritura completa del set del usuario (delete + insert) para evitar
  // violar transitoriamente los UNIQUE (user,position) / (user,team) al
  // reordenar, igual que en saveGroupStandings.
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(predictionsBestThirds)
        .where(eq(predictionsBestThirds.userId, user.id));
      if (parsed.data.length > 0) {
        await tx.insert(predictionsBestThirds).values(
          parsed.data.map((e) => ({
            userId: user.id,
            position: e.position,
            teamCode: e.teamCode,
          })),
        );
      }
    });
  } catch (err) {
    logger.error('saveBestThirdsPrediction failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: parsed.data.length } };
}

// --- Podio (predictions_awards, kinds champion/runner_up/third) ---

// Los 3 puestos se guardan en una sola acción para validar atómicamente la
// regla "los 3 equipos distintos". Un puesto null borra esa fila; un puesto con
// equipo se upserta sobre (user_id, kind). Los premios individuales (botas y
// balones) los gestionará otra acción en la sub-slice 4.7.
export async function savePodiumPrediction(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isAwardsPredictionLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = podiumPredictionSchema.safeParse(input);
  if (!parsed.success) {
    const distinct = parsed.error.issues.find(
      (i) => i.message === 'Cada posición del podio debe ser un equipo diferente.',
    );
    return {
      error: {
        code: 'INVALID_INPUT',
        message: distinct ? distinct.message : 'Datos inválidos.',
      },
    };
  }

  const entries = [
    { kind: 'champion' as const, teamCode: parsed.data.champion },
    { kind: 'runner_up' as const, teamCode: parsed.data.runnerUp },
    { kind: 'third' as const, teamCode: parsed.data.third },
  ];
  const filled = entries.filter(
    (e): e is { kind: typeof e.kind; teamCode: string } => e.teamCode !== null,
  );
  const emptyKinds = entries.filter((e) => e.teamCode === null).map((e) => e.kind);

  // Cada equipo seleccionado debe existir en el catálogo (data-model.md §4.5).
  if (filled.length > 0) {
    const teamRows = await db.select({ code: teams.code }).from(teams);
    const knownCodes = new Set(teamRows.map((t) => t.code));
    if (!filled.every((e) => knownCodes.has(e.teamCode))) {
      return {
        error: { code: 'INVALID_INPUT', message: 'Algún equipo no existe.' },
      };
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const e of filled) {
        await tx
          .insert(predictionsAwards)
          .values({ userId: user.id, kind: e.kind, teamCode: e.teamCode })
          .onConflictDoUpdate({
            target: [predictionsAwards.userId, predictionsAwards.kind],
            set: { teamCode: e.teamCode, updatedAt: new Date() },
          });
      }
      if (emptyKinds.length > 0) {
        await tx
          .delete(predictionsAwards)
          .where(
            and(
              eq(predictionsAwards.userId, user.id),
              inArray(predictionsAwards.kind, emptyKinds),
            ),
          );
      }
    });
  } catch (err) {
    logger.error('savePodiumPrediction failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: filled.length } };
}

// --- Premios individuales (predictions_awards, kinds boot_*/ball_*) ---

// Separada de savePodiumPrediction: validación distinta (player_name vs team_code)
// y cero acoplamiento entre las dos. Cada campo se guarda en su propia fila por
// `kind`; un nombre vacío (null) borra esa fila. Un nombre presente se upserta
// poniendo team_code a null (la fila de un boot/ball nunca lleva equipo).
export async function savePlayerAwardsPrediction(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isAwardsPredictionLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = playerAwardsPredictionSchema.safeParse(input);
  if (!parsed.success) {
    const distinct = parsed.error.issues.find(
      (i) =>
        i.message === 'Cada bota debe ser un jugador diferente.' ||
        i.message === 'Cada balón debe ser un jugador diferente.',
    );
    return {
      error: {
        code: 'INVALID_INPUT',
        message: distinct ? distinct.message : 'Datos inválidos.',
      },
    };
  }

  const entries = [
    { kind: 'boot_gold' as const, playerName: parsed.data.bootGold },
    { kind: 'boot_silver' as const, playerName: parsed.data.bootSilver },
    { kind: 'boot_bronze' as const, playerName: parsed.data.bootBronze },
    { kind: 'ball_gold' as const, playerName: parsed.data.ballGold },
    { kind: 'ball_silver' as const, playerName: parsed.data.ballSilver },
    { kind: 'ball_bronze' as const, playerName: parsed.data.ballBronze },
  ];
  const filled = entries.filter(
    (e): e is { kind: typeof e.kind; playerName: string } =>
      e.playerName !== null,
  );
  const emptyKinds = entries
    .filter((e) => e.playerName === null)
    .map((e) => e.kind);

  try {
    await db.transaction(async (tx) => {
      for (const e of filled) {
        await tx
          .insert(predictionsAwards)
          .values({ userId: user.id, kind: e.kind, playerName: e.playerName })
          .onConflictDoUpdate({
            target: [predictionsAwards.userId, predictionsAwards.kind],
            set: { playerName: e.playerName, teamCode: null, updatedAt: new Date() },
          });
      }
      if (emptyKinds.length > 0) {
        await tx
          .delete(predictionsAwards)
          .where(
            and(
              eq(predictionsAwards.userId, user.id),
              inArray(predictionsAwards.kind, emptyKinds),
            ),
          );
      }
    });
  } catch (err) {
    logger.error('savePlayerAwardsPrediction failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: filled.length } };
}

// --- Bracket eliminatorio (predictions_knockout) ---

// Una predicción por cruce: el usuario pulsa el ganador y se guarda al vuelo.
// Bracket RÍGIDO (ADR 0003): NO validamos que el equipo elegido juegue realmente
// ese cruce según el resto de predicciones; esa coherencia es warning cross-tab
// y se refleja en el resumen global (sub-slice 4.8). Aquí solo: el partido es de
// eliminatorias y el equipo existe en el catálogo.
export async function saveKnockoutPrediction(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isKnockoutLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = knockoutPredictionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }

  const [matchRow] = await db
    .select({ id: matches.id, phase: matches.phase })
    .from(matches)
    .where(eq(matches.id, parsed.data.matchId));
  if (!matchRow || matchRow.phase === 'grupos') {
    return {
      error: { code: 'INVALID_INPUT', message: 'El cruce no es de eliminatorias.' },
    };
  }

  const [teamRow] = await db
    .select({ code: teams.code })
    .from(teams)
    .where(eq(teams.code, parsed.data.winnerTeamCode));
  if (!teamRow) {
    return { error: { code: 'INVALID_INPUT', message: 'Algún equipo no existe.' } };
  }

  try {
    await db
      .insert(predictionsKnockout)
      .values({
        userId: user.id,
        matchId: parsed.data.matchId,
        winnerTeamCode: parsed.data.winnerTeamCode,
      })
      .onConflictDoUpdate({
        target: [predictionsKnockout.userId, predictionsKnockout.matchId],
        set: {
          winnerTeamCode: parsed.data.winnerTeamCode,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    logger.error('saveKnockoutPrediction failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: 1 } };
}

// --- Orden de cada grupo (predictions_group_standings) ---

export async function saveGroupStandings(
  input: unknown,
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }

  if (isGroupStandingsLocked()) {
    return {
      error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' },
    };
  }

  const parsed = groupStandingsBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  if (parsed.data.length === 0) {
    return { data: { saved: 0 } };
  }

  // Cada equipo debe pertenecer al grupo en el que se le coloca (data-model.md
  // §4.2: el CHECK de pertenencia no se puede hacer en Postgres, va en la app).
  const teamRows = await db
    .select({ code: teams.code, groupLetter: teams.groupLetter })
    .from(teams);
  const groupOfTeam = new Map(teamRows.map((t) => [t.code, t.groupLetter]));
  const allCoherent = parsed.data.every(
    (e) => groupOfTeam.get(e.teamCode) === e.groupLetter,
  );
  if (!allCoherent) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'Algún equipo no pertenece al grupo indicado.',
      },
    };
  }

  // Agrupar por letra para reescribir cada grupo por completo. Borrar + insertar
  // (en vez de upsert por posición) evita violar transitoriamente el UNIQUE
  // (user, grupo, equipo) al reordenar: durante un swap, mover un equipo a una
  // nueva posición chocaría con su fila antigua todavía presente.
  const byGroup = new Map<string, typeof parsed.data>();
  for (const e of parsed.data) {
    const list = byGroup.get(e.groupLetter) ?? [];
    list.push(e);
    byGroup.set(e.groupLetter, list);
  }

  try {
    await db.transaction(async (tx) => {
      for (const [groupLetter, entries] of byGroup) {
        await tx
          .delete(predictionsGroupStandings)
          .where(
            and(
              eq(predictionsGroupStandings.userId, user.id),
              eq(predictionsGroupStandings.groupLetter, groupLetter),
            ),
          );
        await tx.insert(predictionsGroupStandings).values(
          entries.map((e) => ({
            userId: user.id,
            groupLetter: e.groupLetter,
            position: e.position,
            teamCode: e.teamCode,
          })),
        );
      }
    });
  } catch (err) {
    logger.error('saveGroupStandings failed', { err, userId: user.id });
    return internalError();
  }

  revalidatePath('/porra');
  return { data: { saved: parsed.data.length } };
}
