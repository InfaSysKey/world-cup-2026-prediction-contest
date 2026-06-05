'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requireAdminAction, type ActionError } from '@/lib/auth/require-admin-action';
import { db, matches } from '@/lib/db';
import { logger } from '@/lib/logger';
import { computeGroupWinner } from '@/lib/matches/compute-winner';
import { matchResultSchema } from '@/lib/validators/admin';

export type SaveMatchResultState =
  | { data: { matchId: number }; error?: never }
  | { data?: never; error: ActionError }
  | Record<string, never>;

export async function saveMatchResultAction(
  _prev: SaveMatchResultState,
  formData: FormData,
): Promise<SaveMatchResultState> {
  const guard = await requireAdminAction();
  if (guard.error) {
    return { error: guard.error };
  }

  const parsed = matchResultSchema.safeParse({
    matchId: formData.get('matchId'),
    isKnockout: formData.get('isKnockout'),
    golesLocal: formData.get('golesLocal'),
    golesVisitante: formData.get('golesVisitante'),
    winnerTeamCode: formData.get('winnerTeamCode') ?? undefined,
  });
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  const { matchId, golesLocal, golesVisitante, winnerTeamCode } = parsed.data;

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) {
    return { error: { code: 'NOT_FOUND', message: 'Partido no encontrado.' } };
  }
  if (!match.homeTeamCode || !match.awayTeamCode) {
    return {
      error: {
        code: 'MATCH_NOT_RESOLVED',
        message: 'Este cruce aún no tiene los dos equipos asignados.',
      },
    };
  }

  let realWinnerTeamCode: string | null;
  if (match.phase === 'grupos') {
    realWinnerTeamCode = computeGroupWinner(
      match.homeTeamCode,
      match.awayTeamCode,
      golesLocal,
      golesVisitante,
    );
  } else {
    if (
      winnerTeamCode !== match.homeTeamCode &&
      winnerTeamCode !== match.awayTeamCode
    ) {
      return {
        error: {
          code: 'INVALID_INPUT',
          message: 'El ganador debe ser uno de los dos equipos del cruce.',
        },
      };
    }
    realWinnerTeamCode = winnerTeamCode;
  }

  try {
    await db
      .update(matches)
      .set({
        realGolesLocal: golesLocal,
        realGolesVisitante: golesVisitante,
        realWinnerTeamCode,
        status: 'finished',
      })
      .where(eq(matches.id, matchId));
  } catch (err) {
    logger.error('saveMatchResultAction failed', { err, matchId });
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se pudo guardar el resultado. Inténtalo de nuevo.',
      },
    };
  }

  revalidatePath('/admin/partidos');
  return { data: { matchId } };
}
