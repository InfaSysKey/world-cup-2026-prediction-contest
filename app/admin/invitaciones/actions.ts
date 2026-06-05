'use server';

import { getCurrentUser } from '@/lib/auth/current-user';
import { generateInvitation } from '@/lib/auth/invitations';
import { logger } from '@/lib/logger';
import { invitationSchema } from '@/lib/validators/auth';

export type GenerateInvitationState =
  | { data: { url: string }; error?: never }
  | { data?: never; error: { code: string; message: string } }
  | Record<string, never>;

export async function generateInvitationAction(
  _prev: GenerateInvitationState,
  formData: FormData,
): Promise<GenerateInvitationState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }
  if (!user.isAdmin) {
    return {
      error: { code: 'FORBIDDEN', message: 'Acceso reservado al administrador.' },
    };
  }

  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }

  try {
    const invitation = await generateInvitation({
      createdBy: user.id,
      note: parsed.data.note,
    });
    const url = `${process.env.APP_URL}/registro?token=${invitation.token}`;
    return { data: { url } };
  } catch (err) {
    logger.error('generateInvitationAction failed', { err, userId: user.id });
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'No se ha podido generar la invitación. Inténtalo de nuevo.',
      },
    };
  }
}
