import type { User } from '@/lib/db';

import { getCurrentUser } from './current-user';

export type ActionError = { code: string; message: string };

// Guard para Server Actions de admin. A diferencia de requireAdmin() (que hace
// redirect/forbidden en páginas), aquí devolvemos el error como dato para que la
// action lo propague en su estado y el formulario lo muestre.
export async function requireAdminAction(): Promise<
  { user: User; error?: never } | { user?: never; error: ActionError }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }
  if (!user.isAdmin) {
    return {
      error: { code: 'FORBIDDEN', message: 'Acceso reservado al administrador.' },
    };
  }
  return { user };
}
