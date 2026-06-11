'use client';

import { useActionState } from 'react';

import { Flag } from '@/components/porra/flag';
import { MatchDuel } from '@/components/porra/match-duel';

import { saveMatchResultAction, type SaveMatchResultState } from './actions';

export type MatchRowData = {
  id: number;
  isKnockout: boolean;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  homeFlagCode: string;
  awayFlagCode: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  winnerTeamCode: string | null;
  status: string;
};

const INITIAL: SaveMatchResultState = {};

// Resultado oficial de un partido (admin). Reusa el mismo duelo que /porra; el
// wiring de inputs es por `name`/`defaultValue` (form + Server Action) en vez de
// controlado. El selector de ganador y el botón Guardar van en un footer bajo el
// duelo. Las banderas llegan en 10.4 (admin ya tiene los códigos de equipo).
export function MatchResultRow({ match }: { match: MatchRowData }) {
  const [state, action, pending] = useActionState(
    saveMatchResultAction,
    INITIAL,
  );
  const placed = match.golesLocal != null && match.golesVisitante != null;

  return (
    <form
      action={action}
      data-testid={`match-row-${match.id}`}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="isKnockout" value={String(match.isKnockout)} />

      <MatchDuel
        placed={placed}
        placedStatus="✓ oficial"
        home={{
          name: match.homeName,
          flag: <Flag code={match.homeFlagCode} name={match.homeName} size="lg" />,
        }}
        away={{
          name: match.awayName,
          flag: <Flag code={match.awayFlagCode} name={match.awayName} size="lg" />,
        }}
        homeInput={{
          name: 'golesLocal',
          required: true,
          defaultValue: match.golesLocal ?? '',
          'aria-label': `Goles ${match.homeName}`,
        }}
        awayInput={{
          name: 'golesVisitante',
          required: true,
          defaultValue: match.golesVisitante ?? '',
          'aria-label': `Goles ${match.awayName}`,
        }}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {match.isKnockout ? (
          <select
            name="winnerTeamCode"
            defaultValue={match.winnerTeamCode ?? ''}
            aria-label="Ganador del cruce"
            className="rounded-[10px] border border-slot bg-surface px-2 py-2"
          >
            <option value="">Ganador…</option>
            <option value={match.homeCode}>{match.homeName}</option>
            <option value={match.awayCode}>{match.awayName}</option>
          </select>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-cromo-cobalt px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
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
          <span
            data-testid={`match-saved-${match.id}`}
            className="text-xs text-cromo-mint"
          >
            guardado
          </span>
        ) : null}
      </div>
    </form>
  );
}
