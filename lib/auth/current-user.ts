import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/constants';
import type { User } from '@/lib/db';

import { validateSession } from './sessions';

// Devuelve el usuario autenticado a partir de la cookie de sesión, o null.
// Corre en runtime Node (Server Components/Actions), no en el middleware Edge.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }
  return validateSession(sessionId);
}
