'use client';

import { useActionState } from 'react';

import { MAX_GOLES } from '@/lib/constants';

import { saveMatchResultAction, type SaveMatchResultState } from './actions';

export type MatchRowData = {
  id: number;
  isKnockout: boolean;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  winnerTeamCode: string | null;
  status: string;
};

const INITIAL: SaveMatchResultState = {};

const golesInputClass =
  'w-14 rounded border border-slot px-2 py-1 text-center';

export function MatchResultRow({ match }: { match: MatchRowData }) {
  const [state, action, pending] = useActionState(
    saveMatchResultAction,
    INITIAL,
  );

  return (
    <form
      action={action}
      data-testid={`match-row-${match.id}`}
      className="flex flex-wrap items-center gap-2 border-b border-slot py-2 text-sm"
    >
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="isKnockout" value={String(match.isKnockout)} />

      <span className="w-40 truncate text-right">{match.homeName}</span>
      <input
        name="golesLocal"
        type="number"
        min={0}
        max={MAX_GOLES}
        required
        defaultValue={match.golesLocal ?? ''}
        aria-label={`Goles ${match.homeName}`}
        className={golesInputClass}
      />
      <span className="text-ink-muted">–</span>
      <input
        name="golesVisitante"
        type="number"
        min={0}
        max={MAX_GOLES}
        required
        defaultValue={match.golesVisitante ?? ''}
        aria-label={`Goles ${match.awayName}`}
        className={golesInputClass}
      />
      <span className="w-40 truncate">{match.awayName}</span>

      {match.isKnockout ? (
        <select
          name="winnerTeamCode"
          defaultValue={match.winnerTeamCode ?? ''}
          aria-label="Ganador del cruce"
          className="rounded border border-slot px-2 py-1"
        >
          <option value="">Ganador…</option>
          <option value={match.homeCode}>{match.homeName}</option>
          <option value={match.awayCode}>{match.awayName}</option>
        </select>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-cromo-cobalt px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>

      <span
        data-testid={`match-status-${match.id}`}
        className="text-xs text-ink-muted"
      >
        {match.status}
      </span>

      {state.error ? (
        <span role="alert" className="text-xs text-cromo-coral">
          {state.error.message}
        </span>
      ) : null}
      {state.data ? (
        <span data-testid={`match-saved-${match.id}`} className="text-xs text-cromo-mint">
          guardado
        </span>
      ) : null}
    </form>
  );
}
