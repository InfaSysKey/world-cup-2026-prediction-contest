import { and, eq, gt, isNull } from 'drizzle-orm';

import { INVITATION_EXPIRY_DAYS } from '@/lib/constants';
import { db, invitations, type Invitation } from '@/lib/db';

import { randomToken } from './crypto';

const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Transacción de Drizzle: mismas operaciones que `db`, pero atómica.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Subconjunto que basta para decidir si una invitación se puede consumir.
type InvitationUsability = Pick<Invitation, 'usedBy' | 'expiresAt'>;

// Una invitación es usable si no ha sido consumida y aún no ha caducado.
export function isInvitationUsable(
  invitation: InvitationUsability,
  now: Date,
): boolean {
  return invitation.usedBy === null && invitation.expiresAt > now;
}

// Crea una invitación nueva con token aleatorio y caducidad a 7 días.
export async function generateInvitation(params: {
  createdBy: number;
  note?: string;
}): Promise<Invitation> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
  const [row] = await db
    .insert(invitations)
    .values({ token, createdBy: params.createdBy, note: params.note, expiresAt })
    .returning();
  return row;
}

// Reclama un token de un solo uso de forma atómica: el WHERE exige que siga sin
// usar y sin caducar, así que dos registros simultáneos no pueden consumirlo a
// la vez. Devuelve la invitación consumida, o null si no era válida.
export async function claimInvitation(
  tx: Tx,
  token: string,
  usedBy: number,
): Promise<Invitation | null> {
  const [row] = await tx
    .update(invitations)
    .set({ usedBy, usedAt: new Date() })
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.usedBy),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .returning();
  return row ?? null;
}
