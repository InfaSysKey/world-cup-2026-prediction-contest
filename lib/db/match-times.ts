import { db, matches } from '@/lib/db';

// Pitidos iniciales de los 104 partidos, para el indicador de bloqueo (7.5).
// Catálogo del torneo; no depende del usuario.
export async function loadMatchScheduledTimes(): Promise<Date[]> {
  const rows = await db
    .select({ scheduledAt: matches.scheduledAt })
    .from(matches);
  return rows.map((r) => r.scheduledAt);
}
