import { db, pool, matches, teams } from '../index';
import { MATCHES } from './matches';
import { TEAMS } from './teams';

// Seed idempotente: `onConflictDoNothing` sobre las PKs (teams.code, matches.id)
// hace que una segunda ejecución no duplique nada.
async function seed(): Promise<void> {
  await db.insert(teams).values(TEAMS).onConflictDoNothing();
  await db.insert(matches).values(MATCHES).onConflictDoNothing();

  const teamRows = await db.select({ code: teams.code }).from(teams);
  const matchRows = await db.select({ id: matches.id }).from(matches);
  console.log(
    `Seed OK: ${teamRows.length} equipos, ${matchRows.length} partidos.`,
  );
}

seed()
  .catch((err) => {
    console.error('Error en el seed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
