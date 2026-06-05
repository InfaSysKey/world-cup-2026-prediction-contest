'use client';

import { useActionState } from 'react';

import { saveActualAwardAction, type AdminActionState } from './actions';
import type { TeamOption } from './group-standings-form';

const INITIAL: AdminActionState = {};

export function AwardForm({
  kind,
  label,
  isPodium,
  teams,
  currentTeamCode,
  currentPlayerName,
}: {
  kind: string;
  label: string;
  isPodium: boolean;
  teams: TeamOption[];
  currentTeamCode: string | null;
  currentPlayerName: string | null;
}) {
  const [state, action, pending] = useActionState(
    saveActualAwardAction,
    INITIAL,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="kind" value={kind} />
      <span className="w-40">{label}</span>
      {isPodium ? (
        <select
          name="teamCode"
          defaultValue={currentTeamCode ?? ''}
          aria-label={label}
          className="rounded border border-zinc-300 px-2 py-1"
        >
          <option value="">—</option>
          {teams.map((team) => (
            <option key={team.code} value={team.code}>
              {team.nameEs}
            </option>
          ))}
        </select>
      ) : (
        <input
          name="playerName"
          defaultValue={currentPlayerName ?? ''}
          maxLength={80}
          placeholder="Nombre del jugador"
          aria-label={label}
          className="rounded border border-zinc-300 px-2 py-1"
        />
      )}
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
