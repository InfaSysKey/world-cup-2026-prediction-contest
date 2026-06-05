import { randomBytes } from 'node:crypto';

import { AUTH_TOKEN_BYTES } from '@/lib/constants';

// Token aleatorio en base64url, usado tanto para ids de sesión como para
// tokens de invitación. 32 bytes ≈ 43 caracteres, suficiente entropía.
export function randomToken(bytes: number = AUTH_TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}
