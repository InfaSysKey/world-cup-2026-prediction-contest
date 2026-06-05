'use client';

import { useActionState } from 'react';

import { saveBestThirdsAction, type AdminActionState } from './actions';
import type { TeamOption } from './group-standings-form';

const INITIAL: AdminActionState = {};
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function BestThirdsForm({
  teams,
  current,
}: {
  teams: TeamOption[];
  current: Record<number, string | undefined>;
}) {
  const [state, action, pending] = useActionState(
    saveBestThirdsAction,
    INITIAL,
  );

  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((pos) => (
          <label key={pos} className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500">#{pos}</span>
            <select
              name="teamCodes"
              defaultValue={current[pos] ?? ''}
              aria-label={`Mejor tercero ${pos}`}
              className="rounded border border-zinc-300 px-2 py-1"
            >
              <option value="">—</option>
              {teams.map((team) => (
                <option key={team.code} value={team.code}>
                  {team.nameEs}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar terceros'}
        </button>
        {state.error ? (
          <span role="alert" className="text-xs text-red-600">
            {state.error.message}
          </span>
        ) : null}
        {state.ok ? (
          <span className="text-xs text-green-600">guardado</span>
        ) : null}
      </div>
    </form>
  );
}
