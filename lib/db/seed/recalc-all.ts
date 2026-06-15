// Script CLI para recálculo total de scores, pensado como paso de despliegue de
// la adopción de las reglas v2.0 del Excel canónico (ADR 0009). No es una admin
// action: lo ejecuta el operador del despliegue con `tsx`. Reusa
// `recalculateAll` del orquestador, así que la lógica de cálculo y auditoría es
// la misma que en producción.
//
// Uso:
//   npx tsx lib/db/seed/recalc-all.ts [--reason "Texto libre"]
//
// El admin que dispara el recálculo se deriva automáticamente del primer
// usuario con `is_admin = true`. La fila de auditoría queda en
// `score_recalculations` para la línea histórica de deltas del ranking.

import { eq } from 'drizzle-orm';

import { db, users } from '@/lib/db';
import { recalculateAll } from '@/lib/scoring/index';

function parseReason(): string {
  const idx = process.argv.indexOf('--reason');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return 'Recálculo total tras adopción de reglas v2.0 del Excel canónico (ADR 0009)';
}

async function main(): Promise<void> {
  const [admin] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);
  if (!admin) {
    console.error('No hay ningún usuario con is_admin=true en la BD.');
    process.exit(1);
  }
  const reason = parseReason();
  console.log(`Disparado por: ${admin.email} (id=${admin.id})`);
  console.log(`Motivo:         ${reason}`);
  const { usersAffected } = await recalculateAll(admin.id, reason);
  console.log(`Recalculados: ${usersAffected} usuarios.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
