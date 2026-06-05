'use server';

import { redirect } from 'next/navigation';

import { registerUser } from '@/lib/auth/register';
import { logger } from '@/lib/logger';
import { registerSchema } from '@/lib/validators/auth';

export type RegisterFormState = {
  error?: { message: string; fields?: Record<string, string[] | undefined> };
};

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: {
        message: 'Revisa los datos introducidos.',
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  let result;
  try {
    result = await registerUser(parsed.data);
  } catch (err) {
    logger.error('registerAction failed', { err });
    return { error: { message: 'Algo ha ido mal. Inténtalo de nuevo.' } };
  }

  if (!result.ok) {
    const message =
      result.code === 'CONFLICT'
        ? 'Ese email o nick ya está en uso.'
        : 'El enlace de invitación no es válido o ha caducado.';
    return { error: { message } };
  }

  redirect('/porra');
}
