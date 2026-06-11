import { redirect } from 'next/navigation';

import { Cromo } from '@/components/porra/cromo';
import { TeamLabel } from '@/components/porra/team-label';
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
    return <span className="text-ink-muted">—</span>;
  }
  return (
    <span
      className={cn(
        'font-mono tabular-nums font-semibold',
        points > 0 && 'text-cromo-mint',
        points < 0 && 'text-cromo-coral',
        points === 0 && 'text-ink-muted',
      )}
    >
      {points > 0 ? `+${points}` : points} pts
    </span>
  );
}

function MatchRow({ match }: { match: CalendarMatch }) {
  return (
    <li className="flex flex-col gap-1 border-b border-slot py-2 last:border-0">
      <div className="flex items-center justify-between gap-2 text-sm text-ink">
        <span className="min-w-0">
          <TeamLabel flagCode={match.home.flagCode} name={match.home.name} />
        </span>
        <span className="shrink-0 font-mono font-medium tabular-nums">
          {match.officialResult ?? 'vs'}
        </span>
        <span className="flex min-w-0 justify-end">
          <TeamLabel flagCode={match.away.flagCode} name={match.away.name} />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span>{DATE_FORMAT.format(match.scheduledAt)}</span>
        <span>
          Mi predicción:{' '}
          <span className="font-medium text-ink">
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
        <p className="text-eyebrow mb-1">El torneo</p>
        <h1 className="text-display-l mb-2">Partidos</h1>
        <p className="mb-4 text-sm text-ink-muted">
          Calendario, resultados oficiales, tu predicción y los puntos que
          sacaste.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        {PHASE_ORDER.map(({ phase, label }) => {
          const phaseMatches = byPhase.get(phase) ?? [];
          if (phaseMatches.length === 0) {
            return null;
          }
          return (
            <Cromo key={phase} className="w-full max-w-3xl">
              <h2 className="text-display-l mb-2 text-xl">{label}</h2>
              <ul className="flex flex-col">
                {phaseMatches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </ul>
            </Cromo>
          );
        })}
      </div>
    </main>
  );
}
