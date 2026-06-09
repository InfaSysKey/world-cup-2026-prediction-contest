import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/current-user';
import {
  loadMatchCalendar,
  type CalendarMatch,
} from '@/lib/db/match-calendar';
import type { Phase } from '@/lib/db';
import { cn } from '@/lib/utils';

const PHASE_ORDER: ReadonlyArray<{ phase: Phase; label: string }> = [
  { phase: 'grupos', label: 'Fase de grupos' },
  { phase: '1/16', label: '1/16 de final' },
  { phase: '1/8', label: 'Octavos' },
  { phase: 'cuartos', label: 'Cuartos' },
  { phase: 'semi', label: 'Semifinales' },
  { phase: '3-4', label: '3.º y 4.º puesto' },
  { phase: 'final', label: 'Final' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        'tabular-nums font-semibold',
        points > 0 && 'text-green-700',
        points < 0 && 'text-red-700',
        points === 0 && 'text-muted-foreground',
      )}
    >
      {points > 0 ? `+${points}` : points} pts
    </span>
  );
}

function MatchRow({ match }: { match: CalendarMatch }) {
  return (
    <li className="flex flex-col gap-1 border-b py-2 last:border-0">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{match.home}</span>
        <span className="shrink-0 font-medium tabular-nums">
          {match.officialResult ?? 'vs'}
        </span>
        <span className="truncate text-right">{match.away}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{DATE_FORMAT.format(match.scheduledAt)}</span>
        <span>
          Mi predicción:{' '}
          <span className="font-medium text-foreground">
            {match.myPrediction ?? '—'}
          </span>
        </span>
        <PointsBadge points={match.points} />
      </div>
    </li>
  );
}

export default async function PartidosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const calendar = await loadMatchCalendar(user.id);
  const byPhase = new Map<Phase, CalendarMatch[]>();
  for (const m of calendar) {
    const list = byPhase.get(m.phase) ?? [];
    list.push(m);
    byPhase.set(m.phase, list);
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold">Partidos</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Calendario, resultados oficiales, tu predicción y los puntos que sacaste.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        {PHASE_ORDER.map(({ phase, label }) => {
          const phaseMatches = byPhase.get(phase) ?? [];
          if (phaseMatches.length === 0) {
            return null;
          }
          return (
            <Card key={phase} className="w-full max-w-3xl gap-2 p-4">
              <h2 className="text-lg font-semibold">{label}</h2>
              <ul className="flex flex-col">
                {phaseMatches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
