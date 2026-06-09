import { cookies } from 'next/headers';
import { cache } from 'react';

import { SESSION_COOKIE_NAME } from '@/lib/constants';
import type { User } from '@/lib/db';

import { validateSession } from './sessions';

// Devuelve el usuario autenticado a partir de la cookie de sesión, o null.
// Corre en runtime Node (Server Components/Actions), no en el middleware Edge.
//
// Memoizado con cache() de React: layout y page de (porra) lo llaman ambos en el
// mismo request; sin esto, cada render dispara un validateSession (consulta de
// sesión + usuario) duplicado. cache() lo deduplica por request.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }
  return validateSession(sessionId);
});
