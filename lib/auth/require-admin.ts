import { forbidden, redirect } from 'next/navigation';

import type { User } from '@/lib/db';

import { getCurrentUser } from './current-user';

// Para usar en layouts/páginas de servidor de /admin. Sin sesión → /login;
// con sesión pero sin permiso → 403 (forbidden() de Next 15, ver app/forbidden.tsx).
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!user.isAdmin) {
    forbidden();
  }
  return user;
}
