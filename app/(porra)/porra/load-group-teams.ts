import { asc } from 'drizzle-orm';

import { GROUP_LETTERS } from '@/lib/constants';
import { db, teams } from '@/lib/db';
import { flagIconCode } from '@/lib/flags';

export type GroupTeam = {
  code: string;
  name: string;
  flagCode: string;
};

export type GroupTeamsCatalog = {
  groupLetter: string;
  teams: GroupTeam[];
};

// Los 4 equipos de cada grupo A–L, para la lista ordenable del orden de grupo.
// Mismo catálogo para todos los usuarios; no depende de sus predicciones.
export async function loadGroupTeams(): Promise<GroupTeamsCatalog[]> {
  const rows = await db
    .select({
      code: teams.code,
      name: teams.nameEs,
      flagEmoji: teams.flagEmoji,
      groupLetter: teams.groupLetter,
    })
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.code));

  return GROUP_LETTERS.map((groupLetter) => ({
    groupLetter,
    teams: rows
      .filter((r) => r.groupLetter === groupLetter)
      .map(({ code, name, flagEmoji }) => ({
        code,
        name,
        flagCode: flagIconCode(flagEmoji, code),
      })),
  }));
}
