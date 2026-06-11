import { db, teams } from '@/lib/db';
import { flagIconCode } from '@/lib/flags';

export type TeamInfo = { name: string; flagCode: string };

// Mapa code → { nombre, código de bandera } de las 48 selecciones, para resolver
// códigos a etiquetas legibles en las vistas de solo lectura. El flagCode lo
// deriva flagIconCode del emoji sembrado (slice 10.4). Catálogo inmutable tras el seed.
export async function loadTeamsMap(): Promise<Map<string, TeamInfo>> {
  const rows = await db
    .select({ code: teams.code, name: teams.nameEs, flagEmoji: teams.flagEmoji })
    .from(teams);
  return new Map(
    rows.map((r) => [
      r.code,
      { name: r.name, flagCode: flagIconCode(r.flagEmoji, r.code) },
    ]),
  );
}
