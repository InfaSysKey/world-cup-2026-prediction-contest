import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

import { BCRYPT_COST } from '../../constants';
import { requireEnv } from '../../env';
import { db, pool, users } from '../index';

// Crea el primer usuario admin a partir de las variables de bootstrap. Es
// idempotente por email: si ya existe, no hace nada.
async function bootstrap(): Promise<void> {
  const email = requireEnv('ADMIN_BOOTSTRAP_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_BOOTSTRAP_PASSWORD');

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (existing.length > 0) {
    console.log(`El admin ${email} ya existe; nada que hacer.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db.insert(users).values({
    email,
    passwordHash,
    nombre: 'Admin',
    apellidos: 'Porra',
    nickname: 'admin',
    isAdmin: true,
  });
  console.log(`Admin ${email} creado.`);
}

bootstrap()
  .catch((err) => {
    console.error('Error en admin:bootstrap:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
