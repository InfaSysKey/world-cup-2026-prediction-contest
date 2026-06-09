import { db, teams } from '@/lib/db';

export type TeamInfo = { name: string; flag: string };

// Mapa code → { nombre, bandera } de las 48 selecciones, para resolver códigos a
// etiquetas legibles en las vistas de solo lectura. Catálogo inmutable tras el seed.
export async function loadTeamsMap(): Promise<Map<string, TeamInfo>> {
  const rows = await db
    .select({ code: teams.code, name: teams.nameEs, flag: teams.flagEmoji })
    .from(teams);
  return new Map(rows.map((r) => [r.code, { name: r.name, flag: r.flag }]));
}
