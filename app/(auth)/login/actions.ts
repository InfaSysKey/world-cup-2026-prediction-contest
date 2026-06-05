'use server';

import { redirect } from 'next/navigation';

import { loginUser } from '@/lib/auth/login';
import { logger } from '@/lib/logger';
import { loginSchema } from '@/lib/validators/auth';

export type AuthFormState = {
  error?: { message: string; fields?: Record<string, string[] | undefined> };
};

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
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
    result = await loginUser(parsed.data);
  } catch (err) {
    logger.error('loginAction failed', { err });
    return { error: { message: 'Algo ha ido mal. Inténtalo de nuevo.' } };
  }

  if (!result.ok) {
    return { error: { message: 'Email o contraseña incorrectos.' } };
  }

  redirect('/porra');
}
