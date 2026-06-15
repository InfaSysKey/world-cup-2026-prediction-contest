'use client';

import type { ReactNode } from 'react';

import type { AutoSaveStatus } from '@/lib/hooks/use-auto-save';
import type { BracketSide, ResolvedMatch } from '@/lib/scoring/resolve-bracket';

// Una ronda del bracket (1/16, 1/8, …). Presentacional: el estado de las
// predicciones y la resolución del árbol viven en el stepper, que pasa aquí los
// cruces ya resueltos. Por cada cruce el usuario pulsa uno de los dos lados como
// ganador; un lado todavía no determinado (faltan predicciones aguas arriba) se
// muestra como "pendiente" y no se puede elegir.

type BracketPhaseProps = {
  tabId: string;
  matches: ResolvedMatch[];
  // code → <TeamLabel> (bandera + nombre). Devuelve el code si el equipo no está
  // en el catálogo.
  teamLabel: (code: string) => ReactNode;
  locked: boolean;
  status: AutoSaveStatus;
  onRetry: () => void;
  onPick: (matchId: number, winnerTeamCode: string) => void;
  // Marcador predicho al 120' (90'+prórroga, sin penaltis) por cruce. Se muestra
  // entre los botones de ganador como read-only (scoring-rules.md §3.3). Los
  // marcadores no se editan desde esta UI: están bloqueados por el lock global
  // y vinieron del Excel del usuario en la importación.
  scoreByMatch?: ReadonlyMap<
    number,
    { golesLocal: number; golesVisitante: number }
  >;
};

// Traduce el slot_ref simbólico a una descripción en español para los lados que
// aún no se pueden resolver.
function describeRef(ref: string): string {
  const standing = /^([12])([A-L])$/.exec(ref);
  if (standing) {
    return `${standing[1]}.º del grupo ${standing[2]}`;
  }
  if (/^3[A-L]+$/.test(ref)) {
    return 'mejor 3.º (pendiente del orden de grupos)';
  }
  if (/^W\d+$/.test(ref)) {
    return 'ganador de un cruce anterior';
  }
  if (/^L\d+$/.test(ref)) {
    return 'perdedor de una semifinal';
  }
  return ref;
}

export function BracketPhase({
  tabId,
  matches,
  teamLabel,
  locked,
  status,
  onRetry,
  onPick,
  scoreByMatch,
}: BracketPhaseProps) {
  return (
    <div
      data-testid={`bracket-phase-${tabId}`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
        <h3 className="text-sm font-semibold text-zinc-700">
          Elige el ganador de cada cruce
        </h3>
        <AutoSaveStatus status={status} locked={locked} onRetry={onRetry} />
      </div>

      {tabId === 'dieciseisavos' ? (
        <p
          data-testid="bracket-rigid-note"
          className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
        >
          Tu predicción es literal: si el equipo que pones en una ronda no llega a
          ella según tus predicciones anteriores, ese cruce no puntuará.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {matches.map((m) => {
          const score = scoreByMatch?.get(m.matchId) ?? null;
          return (
            <li
              key={m.matchId}
              data-testid={`bracket-match-${m.matchId}`}
              className="flex items-stretch gap-2"
            >
              <SideButton
                matchId={m.matchId}
                position="home"
                side={m.home}
                picked={
                  m.pickedWinner !== null && m.pickedWinner === m.home.teamCode
                }
                teamLabel={teamLabel}
                locked={locked}
                onPick={onPick}
              />
              <ScoreOrVs matchId={m.matchId} score={score} />
              <SideButton
                matchId={m.matchId}
                position="away"
                side={m.away}
                picked={
                  m.pickedWinner !== null && m.pickedWinner === m.away.teamCode
                }
                teamLabel={teamLabel}
                locked={locked}
                onPick={onPick}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreOrVs({
  matchId,
  score,
}: {
  matchId: number;
  score: { golesLocal: number; golesVisitante: number } | null;
}) {
  if (score === null) {
    return (
      <span className="flex shrink-0 items-center px-1 text-xs font-semibold text-zinc-400">
        vs
      </span>
    );
  }
  return (
    <span
      data-testid={`bracket-score-${matchId}`}
      className="flex shrink-0 items-center px-2 text-sm font-semibold tabular-nums text-ink"
      title="Marcador al 120' (90'+prórroga, sin penaltis). No editable: viene de tu Excel."
    >
      {score.golesLocal} - {score.golesVisitante}
    </span>
  );
}

function SideButton({
  matchId,
  position,
  side,
  picked,
  teamLabel,
  locked,
  onPick,
}: {
  matchId: number;
  position: 'home' | 'away';
  side: BracketSide;
  picked: boolean;
  teamLabel: (code: string) => ReactNode;
  locked: boolean;
  onPick: (matchId: number, winnerTeamCode: string) => void;
}) {
  if (side.teamCode === null) {
    return (
      <span
        data-testid={`bracket-side-pending-${matchId}-${position}`}
        className="flex flex-1 items-center rounded border border-dashed border-zinc-300 px-3 py-2 text-xs italic text-zinc-400"
      >
        {describeRef(side.ref)}
      </span>
    );
  }
  const code = side.teamCode;
  return (
    <button
      type="button"
      data-testid={`bracket-pick-${matchId}-${position}`}
      aria-pressed={picked}
      disabled={locked}
      onClick={() => onPick(matchId, code)}
      className={`flex flex-1 items-center rounded border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        picked
          ? 'border-green-500 bg-green-50 font-semibold text-green-800'
          : 'border-zinc-300 bg-white hover:border-zinc-400'
      }`}
    >
      {teamLabel(code)}
    </button>
  );
}

function AutoSaveStatus({
  status,
  locked,
  onRetry,
}: {
  status: AutoSaveStatus;
  locked: boolean;
  onRetry: () => void;
}) {
  if (locked) {
    return <span className="text-xs font-medium text-amber-700">BLOQUEADA</span>;
  }
  if (status === 'saving') {
    return (
      <span data-testid="bracket-autosave-status" className="text-xs text-zinc-500">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="bracket-autosave-status" className="text-xs text-green-600">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="bracket-autosave-status"
        className="flex items-center gap-2 text-xs text-red-600"
      >
        Error al guardar
        <button type="button" onClick={onRetry} className="underline">
          Reintentar
        </button>
      </span>
    );
  }
  return (
    <span data-testid="bracket-autosave-status" className="text-xs text-zinc-400">
      Sin cambios
    </span>
  );
}
