import { GROUP_LETTERS, PODIUM_AWARD_KINDS } from '@/lib/constants';
import { AWARD_KINDS, db } from '@/lib/db';

import { AwardForm } from './award-form';
import { BestThirdsForm } from './best-thirds-form';
import { GroupStandingsForm, type TeamOption } from './group-standings-form';

const AWARD_LABELS: Record<(typeof AWARD_KINDS)[number], string> = {
  champion: 'Campeón',
  runner_up: 'Subcampeón',
  third: '3.º puesto',
  boot_gold: 'Bota de Oro',
  boot_silver: 'Bota de Plata',
  boot_bronze: 'Bota de Bronce',
  ball_gold: 'Balón de Oro',
  ball_silver: 'Balón de Plata',
  ball_bronze: 'Balón de Bronce',
};

const PODIUM_KINDS: readonly string[] = PODIUM_AWARD_KINDS;

export default async function ClasificacionesPage() {
  const allTeams = await db.query.teams.findMany({
    columns: { code: true, nameEs: true, groupLetter: true },
    orderBy: (t, { asc }) => [asc(t.nameEs)],
  });
  const standings = await db.query.actualGroupStandings.findMany();
  const thirds = await db.query.actualBestThirds.findMany();
  const awards = await db.query.actualAwards.findMany();

  const teamsByGroup = new Map<string, TeamOption[]>();
  for (const team of allTeams) {
    const list = teamsByGroup.get(team.groupLetter) ?? [];
    list.push({ code: team.code, nameEs: team.nameEs });
    teamsByGroup.set(team.groupLetter, list);
  }
  const allOptions: TeamOption[] = allTeams.map((t) => ({
    code: t.code,
    nameEs: t.nameEs,
  }));

  const standingByGroup = new Map<string, Record<number, string>>();
  for (const row of standings) {
    const map = standingByGroup.get(row.groupLetter) ?? {};
    map[row.position] = row.teamCode;
    standingByGroup.set(row.groupLetter, map);
  }
  const thirdsByPosition: Record<number, string> = {};
  for (const row of thirds) {
    thirdsByPosition[row.position] = row.teamCode;
  }
  const awardByKind = new Map<
    string,
    { teamCode: string | null; playerName: string | null }
  >();
  for (const row of awards) {
    awardByKind.set(row.kind, {
      teamCode: row.teamCode,
      playerName: row.playerName,
    });
  }

  return (
    <section className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Clasificaciones oficiales</h1>
        <p className="text-sm text-zinc-600">
          Introduce los resultados oficiales que usará el motor de puntos.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Orden final de cada grupo</h2>
        {GROUP_LETTERS.map((letter) => (
          <GroupStandingsForm
            key={letter}
            groupLetter={letter}
            teams={teamsByGroup.get(letter) ?? []}
            current={standingByGroup.get(letter) ?? {}}
          />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">8 mejores terceros (en orden)</h2>
        <BestThirdsForm teams={allOptions} current={thirdsByPosition} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Podio y premios individuales</h2>
        {AWARD_KINDS.map((kind) => {
          const current = awardByKind.get(kind);
          return (
            <AwardForm
              key={kind}
              kind={kind}
              label={AWARD_LABELS[kind]}
              isPodium={PODIUM_KINDS.includes(kind)}
              teams={allOptions}
              currentTeamCode={current?.teamCode ?? null}
              currentPlayerName={current?.playerName ?? null}
            />
          );
        })}
      </div>
    </section>
  );
}
