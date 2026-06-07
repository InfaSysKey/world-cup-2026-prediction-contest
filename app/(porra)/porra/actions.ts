'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/current-user';
import { db, matches, predictionsGroupMatches } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isGroupMatchPredictionLocked } from '@/lib/scoring/locks';
import type { ApiResult } from '@/lib/types';
import { groupMatchPredictionsBatchSchema } from '@/lib/validators/predictions';

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
