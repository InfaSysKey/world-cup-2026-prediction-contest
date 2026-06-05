'use client';

import { useActionState } from 'react';

import { saveGroupStandingAction, type AdminActionState } from './actions';

export type TeamOption = { code: string; nameEs: string };

const INITIAL: AdminActionState = {};
const POSITIONS = [1, 2, 3, 4] as const;

export function GroupStandingsForm({
  groupLetter,
  teams,
  current,
}: {
  groupLetter: string;
  teams: TeamOption[];
  current: Record<number, string | undefined>;
}) {
  const [state, action, pending] = useActionState(
    saveGroupStandingAction,
    INITIAL,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="groupLetter" value={groupLetter} />
      <span className="w-16 font-semibold">Grupo {groupLetter}</span>
      {POSITIONS.map((pos) => (
        <label key={pos} className="flex flex-col gap-0.5">
          <span className="text-xs text-zinc-500">{pos}.º</span>
          <select
            name="teamCodes"
            defaultValue={current[pos] ?? ''}
            aria-label={`Grupo ${groupLetter} posición ${pos}`}
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
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-red-600">
          {state.error.message}
        </span>
      ) : null}
      {state.ok ? <span className="text-xs text-green-600">guardado</span> : null}
    </form>
  );
}
