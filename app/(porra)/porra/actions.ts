'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/current-user';
import {
  db,
  matches,
  predictionsGroupMatches,
  predictionsGroupStandings,
  teams,
} from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  isGroupMatchPredictionLocked,
  isGroupStandingsLocked,
} from '@/lib/scoring/locks';
import type { ApiResult } from '@/lib/types';
import {
  groupMatchPredictionsBatchSchema,
  groupStandingsBatchSchema,
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
