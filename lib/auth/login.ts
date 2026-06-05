import { eq } from 'drizzle-orm';

import { db, users, type User } from '@/lib/db';
import type { LoginInput } from '@/lib/validators/auth';

import { verifyPassword } from './password';
import { createSession } from './sessions';

export type LoginResult = { ok: true; user: User } | { ok: false };

// Verifica credenciales y abre sesión. No revela si el fallo fue por email
// inexistente o por contraseña incorrecta (evita enumeración de usuarios).
export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    return { ok: false };
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    return { ok: false };
  }

  await createSession(user.id);
  return { ok: true, user };
}
