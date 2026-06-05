import { GROUP_LETTERS } from '@/lib/constants';
import { db, type Match } from '@/lib/db';

import { MatchResultRow, type MatchRowData } from './match-result-row';

type MatchWithTeams = Match & {
  homeTeam: { code: string; nameEs: string } | null;
  awayTeam: { code: string; nameEs: string } | null;
};

const KNOCKOUT_PHASES = [
  { phase: '1/16', label: '1/16 de final' },
  { phase: '1/8', label: '1/8 de final' },
  { phase: 'cuartos', label: 'Cuartos' },
  { phase: 'semi', label: 'Semifinales' },
  { phase: '3-4', label: '3.º y 4.º puesto' },
  { phase: 'final', label: 'Final' },
] as const;

function toRowData(match: MatchWithTeams): MatchRowData | null {
  if (!match.homeTeam || !match.awayTeam) {
    return null;
  }
  return {
    id: match.id,
    isKnockout: match.phase !== 'grupos',
    homeCode: match.homeTeam.code,
    awayCode: match.awayTeam.code,
    homeName: match.homeTeam.nameEs,
    awayName: match.awayTeam.nameEs,
    golesLocal: match.realGolesLocal,
    golesVisitante: match.realGolesVisitante,
    winnerTeamCode: match.realWinnerTeamCode,
    status: match.status,
  };
}

function MatchList({ matches }: { matches: MatchWithTeams[] }) {
  return (
    <div className="flex flex-col">
      {matches.map((match) => {
        const row = toRowData(match);
        if (!row) {
          return (
            <p
              key={match.id}
              className="border-b border-zinc-100 py-2 text-sm text-zinc-400"
            >
              #{match.id} · {match.homeSlotRef ?? '?'} – {match.awaySlotRef ?? '?'}{' '}
              (pendiente de resolver)
            </p>
          );
        }
        return <MatchResultRow key={match.id} match={row} />;
      })}
    </div>
  );
}

export default async function PartidosPage() {
  const all = (await db.query.matches.findMany({
    orderBy: (m, { asc }) => [asc(m.scheduledAt), asc(m.id)],
    with: {
      homeTeam: { columns: { code: true, nameEs: true } },
      awayTeam: { columns: { code: true, nameEs: true } },
    },
  })) as MatchWithTeams[];

  const byGroup = new Map<string, MatchWithTeams[]>();
  const byPhase = new Map<string, MatchWithTeams[]>();
  for (const match of all) {
    if (match.phase === 'grupos' && match.groupLetter) {
      const list = byGroup.get(match.groupLetter) ?? [];
      list.push(match);
      byGroup.set(match.groupLetter, list);
    } else if (match.phase !== 'grupos') {
      const list = byPhase.get(match.phase) ?? [];
      list.push(match);
      byPhase.set(match.phase, list);
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Partidos</h1>
        <p className="text-sm text-zinc-600">
          Introduce el marcador final. En grupos el ganador se calcula solo; en
          eliminatorias indícalo (puede venir de penaltis).
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-medium">Fase de grupos</h2>
        {GROUP_LETTERS.map((letter) => {
          const matches = byGroup.get(letter) ?? [];
          if (matches.length === 0) {
            return null;
          }
          return (
            <div key={letter} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-zinc-700">
                Grupo {letter}
              </h3>
              <MatchList matches={matches} />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-medium">Eliminatorias</h2>
        {KNOCKOUT_PHASES.map(({ phase, label }) => {
          const matches = byPhase.get(phase) ?? [];
          if (matches.length === 0) {
            return null;
          }
          return (
            <div key={phase} className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-zinc-700">{label}</h3>
              <MatchList matches={matches} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
