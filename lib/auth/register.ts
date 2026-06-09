import { db, users, type User } from '@/lib/db';
import type { RegisterInput } from '@/lib/validators/auth';

import { claimInvitation } from './invitations';
import { hashPassword } from './password';
import { createSession } from './sessions';

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; code: 'INVALID_TOKEN' | 'CONFLICT' };

// Error interno para abortar la transacción cuando el token no es válido.
class InvalidTokenError extends Error {}

// Postgres 23505 = unique_violation (email o nickname duplicado). Drizzle
// envuelve el error original del driver y guarda la causa en `err.cause`, así
// que recorremos la cadena hasta encontrar el código.
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  while (typeof current === 'object' && current !== null) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// Registra un usuario consumiendo su invitación en la MISMA transacción
// (ADR 0002): si el token no es válido, se revierte la creación del usuario.
// El hashing (lento) queda fuera de la transacción para no alargarla.
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  let user: User;
  try {
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          nombre: input.nombre,
          apellidos: input.apellidos,
          nickname: input.nickname,
          isAdmin: false,
        })
        .returning();

      const invitation = await claimInvitation(tx, input.token, created.id);
      if (!invitation) {
        throw new InvalidTokenError();
      }
      return created;
    });
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      return { ok: false, code: 'INVALID_TOKEN' };
    }
    if (isUniqueViolation(err)) {
      return { ok: false, code: 'CONFLICT' };
    }
    throw err;
  }

  await createSession(user.id);
  return { ok: true, user };
}
