import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS,
} from '@/lib/constants';
import { db, sessions, users, type User } from '@/lib/db';

import { randomToken } from './crypto';

const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const SESSION_DURATION_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;

async function setSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

// Crea una sesión en BD y deja la cookie httpOnly en la respuesta.
export async function createSession(userId: number): Promise<string> {
  const id = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  await setSessionCookie(id);
  return id;
}

// Devuelve el usuario de una sesión válida, o null. Si la sesión existe pero ha
// caducado, la elimina (limpieza perezosa).
export async function validateSession(sessionId: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  if (row.sessions.expiresAt <= new Date()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return row.users;
}

// Invalida la sesión en BD (no solo borra la cookie — CLAUDE.md §6).
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  await clearSessionCookie();
}
