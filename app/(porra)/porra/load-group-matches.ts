import { asc, eq } from 'drizzle-orm';

import { GROUP_LETTERS } from '@/lib/constants';
import { db, matches } from '@/lib/db';

export type GroupMatchCatalogItem = {
  id: number;
  homeCode: string;
  homeName: string;
  homeFlag: string;
  awayCode: string;
  awayName: string;
  awayFlag: string;
};

export type GroupCatalog = {
  groupLetter: string;
  matches: GroupMatchCatalogItem[];
};

// Catálogo de los 72 partidos de fase de grupos con nombre y bandera de cada
// equipo, agrupados por letra A–L y ordenados por fecha dentro de cada grupo.
// Es el mismo para todos los usuarios; no depende de sus predicciones.
export async function loadGroupMatches(): Promise<GroupCatalog[]> {
  const rows = await db.query.matches.findMany({
    where: eq(matches.phase, 'grupos'),
    orderBy: [asc(matches.scheduledAt)],
    with: {
      homeTeam: { columns: { code: true, nameEs: true, flagEmoji: true } },
      awayTeam: { columns: { code: true, nameEs: true, flagEmoji: true } },
    },
  });

  const items = rows.flatMap((m) => {
    const { homeTeam, awayTeam, groupLetter } = m;
    if (!homeTeam || !awayTeam || !groupLetter) {
      return [];
    }
    return [
      {
        groupLetter,
        id: m.id,
        homeCode: homeTeam.code,
        homeName: homeTeam.nameEs,
        homeFlag: homeTeam.flagEmoji,
        awayCode: awayTeam.code,
        awayName: awayTeam.nameEs,
        awayFlag: awayTeam.flagEmoji,
      },
    ];
  });

  return GROUP_LETTERS.map((groupLetter) => ({
    groupLetter,
    matches: items.filter((m) => m.groupLetter === groupLetter),
  }));
}
