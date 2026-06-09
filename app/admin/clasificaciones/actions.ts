'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { requireAdminAction, type ActionError } from '@/lib/auth/require-admin-action';
import { PODIUM_AWARD_KINDS } from '@/lib/constants';
import {
  actualAwards,
  actualBestThirds,
  actualGroupStandings,
  db,
  teams,
} from '@/lib/db';
import { logger } from '@/lib/logger';
import { recalculateAfterResultChangeWithTx } from '@/lib/scoring';
import {
  actualAwardSchema,
  bestThirdsSchema,
  groupStandingSchema,
} from '@/lib/validators/admin';

export type AdminActionState =
  | { ok: true; error?: never }
  | { ok?: never; error: ActionError }
  | Record<string, never>;

function internalError(): AdminActionState {
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'No se pudo guardar. Inténtalo de nuevo.',
    },
  };
}

export async function saveGroupStandingAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const guard = await requireAdminAction();
  if (guard.error) {
    return { error: guard.error };
  }

  const parsed = groupStandingSchema.safeParse({
    groupLetter: formData.get('groupLetter'),
    teamCodes: formData.getAll('teamCodes'),
  });
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  const { groupLetter, teamCodes } = parsed.data;

  const groupTeams = await db.query.teams.findMany({
    where: eq(teams.groupLetter, groupLetter),
    columns: { code: true },
  });
  const validCodes = new Set(groupTeams.map((t) => t.code));
  if (!teamCodes.every((code) => validCodes.has(code))) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: `Algún equipo no pertenece al grupo ${groupLetter}.`,
      },
    };
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < teamCodes.length; i += 1) {
        await tx
          .insert(actualGroupStandings)
          .values({ groupLetter, position: i + 1, teamCode: teamCodes[i] })
          .onConflictDoUpdate({
            target: [
              actualGroupStandings.groupLetter,
              actualGroupStandings.position,
            ],
            set: { teamCode: teamCodes[i], updatedAt: new Date() },
          });
      }
      await recalculateAfterResultChangeWithTx(
        tx,
        { type: 'group_standings', groupLetter },
        guard.user.id,
      );
    });
  } catch (err) {
    logger.error('saveGroupStandingAction failed', { err, groupLetter });
    return internalError();
  }

  revalidatePath('/admin/clasificaciones');
  return { ok: true };
}

export async function saveBestThirdsAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const guard = await requireAdminAction();
  if (guard.error) {
    return { error: guard.error };
  }

  const parsed = bestThirdsSchema.safeParse({
    teamCodes: formData.getAll('teamCodes'),
  });
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  const { teamCodes } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < teamCodes.length; i += 1) {
        await tx
          .insert(actualBestThirds)
          .values({ position: i + 1, teamCode: teamCodes[i] })
          .onConflictDoUpdate({
            target: actualBestThirds.position,
            set: { teamCode: teamCodes[i], updatedAt: new Date() },
          });
      }
      await recalculateAfterResultChangeWithTx(
        tx,
        { type: 'best_thirds' },
        guard.user.id,
      );
    });
  } catch (err) {
    logger.error('saveBestThirdsAction failed', { err });
    return internalError();
  }

  revalidatePath('/admin/clasificaciones');
  return { ok: true };
}

export async function saveActualAwardAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const guard = await requireAdminAction();
  if (guard.error) {
    return { error: guard.error };
  }

  const parsed = actualAwardSchema.safeParse({
    kind: formData.get('kind'),
    teamCode: formData.get('teamCode') ?? undefined,
    playerName: formData.get('playerName') ?? undefined,
  });
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }
  const { kind, teamCode, playerName } = parsed.data;
  const isPodium = (PODIUM_AWARD_KINDS as readonly string[]).includes(kind);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(actualAwards)
        .values({
          kind,
          teamCode: isPodium ? teamCode : null,
          playerName: isPodium ? null : playerName,
        })
        .onConflictDoUpdate({
          target: actualAwards.kind,
          set: {
            teamCode: isPodium ? teamCode : null,
            playerName: isPodium ? null : playerName,
            updatedAt: new Date(),
          },
        });
      await recalculateAfterResultChangeWithTx(
        tx,
        { type: 'award', awardKind: kind },
        guard.user.id,
      );
    });
  } catch (err) {
    logger.error('saveActualAwardAction failed', { err, kind });
    return internalError();
  }

  revalidatePath('/admin/clasificaciones');
  return { ok: true };
}
