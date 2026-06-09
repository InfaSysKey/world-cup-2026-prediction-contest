'use client';

import { useCallback, useMemo, useState } from 'react';

import { saveBestThirdsPrediction } from '@/app/(porra)/porra/actions';
import type {
  GroupTeam,
  GroupTeamsCatalog,
} from '@/app/(porra)/porra/load-group-teams';
import { SortableList, type SortableItem } from '@/components/porra/sortable-list';
import { BEST_THIRDS_COUNT } from '@/lib/constants';
import type { PredictionBestThird, PredictionGroupStanding } from '@/lib/db';
import { useAutoSave } from '@/lib/hooks/use-auto-save';
import {
  analyzeBestThirdsStale,
  type BestThirdStale,
} from '@/lib/validators/cross-tab';

const TOTAL_SLOTS = BEST_THIRDS_COUNT;
const DRAG_MIME = 'application/x-best-third';

type BestThirdsTabProps = {
  teamsCatalog: GroupTeamsCatalog[];
  // Snapshot servidor del orden de grupos: los candidatos son los 3.º de cada
  // grupo. Cambiarlo requiere recargar; el aviso "stale" cubre el desfase.
  standings: PredictionGroupStanding[];
  initial: PredictionBestThird[];
  locked: boolean;
  onGoToGroups?: () => void;
};

type BatchEntry = { position: number; teamCode: string };

function toBatch(selected: string[]): BatchEntry[] {
  return selected.map((teamCode, idx) => ({ position: idx + 1, teamCode }));
}

export function BestThirdsTab({
  teamsCatalog,
  standings,
  initial,
  locked,
  onGoToGroups,
}: BestThirdsTabProps) {
  const teamLabel = useMemo(() => {
    const map = new Map<string, GroupTeam>();
    for (const group of teamsCatalog) {
      for (const team of group.teams) {
        map.set(team.code, team);
      }
    }
    return map;
  }, [teamsCatalog]);

  const teamGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of teamsCatalog) {
      for (const team of group.teams) {
        map.set(team.code, group.groupLetter);
      }
    }
    return map;
  }, [teamsCatalog]);

  // Candidatos = 3.º de cada grupo en standings, en orden de grupo (A→L).
  const candidates = useMemo(() => {
    const thirdByGroup = new Map(
      standings
        .filter((s) => s.position === 3)
        .map((s) => [s.groupLetter, s.teamCode]),
    );
    const out: string[] = [];
    for (const group of teamsCatalog) {
      const code = thirdByGroup.get(group.groupLetter);
      if (code) {
        out.push(code);
      }
    }
    return out;
  }, [standings, teamsCatalog]);

  const [selected, setSelected] = useState<string[]>(() =>
    [...initial].sort((a, b) => a.position - b.position).map((b) => b.teamCode),
  );

  const onSave = useCallback(async (batch: BatchEntry[]) => {
    const res = await saveBestThirdsPrediction(batch);
    if (res.error) {
      throw new Error(res.error.message);
    }
  }, []);

  const { status, save, retry } = useAutoSave<BatchEntry[]>(onSave);

  const commit = useCallback(
    (next: string[]) => {
      setSelected(next);
      save(toBatch(next));
    },
    [save],
  );

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const stale = useMemo<BestThirdStale[]>(
    () =>
      analyzeBestThirdsStale(
        standings,
        selected.map((teamCode, idx) => ({ position: idx + 1, teamCode })),
        teamGroup,
      ),
    [standings, selected, teamGroup],
  );
  const staleByTeam = useMemo(
    () => new Map(stale.map((s) => [s.teamCode, s])),
    [stale],
  );

  function add(teamCode: string) {
    if (locked || selectedSet.has(teamCode) || selected.length >= TOTAL_SLOTS) {
      return;
    }
    commit([...selected, teamCode]);
  }

  function remove(teamCode: string) {
    if (locked) {
      return;
    }
    commit(selected.filter((c) => c !== teamCode));
  }

  function replace(teamCode: string, withCode: string) {
    if (locked || selectedSet.has(withCode)) {
      return;
    }
    commit(selected.map((c) => (c === teamCode ? withCode : c)));
  }

  function reorder(orderedIds: string[]) {
    commit(orderedIds);
  }

  function label(code: string): string {
    const team = teamLabel.get(code);
    return team ? `${team.flag} ${team.name}` : code;
  }

  // --- Empty state: ningún grupo tiene 3.º predicho y nada seleccionado ---
  if (candidates.length === 0 && selected.length === 0) {
    return (
      <div
        data-testid="best-thirds-tab"
        className="flex flex-col items-start gap-3"
      >
        <div
          data-testid="bt-empty-state"
          className="rounded border border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600"
        >
          <p className="font-medium text-zinc-800">
            Aún no puedes elegir los mejores terceros.
          </p>
          <p className="mt-1">
            Los candidatos salen del 3.º de cada grupo. Rellena primero el orden
            de los grupos.
          </p>
          <button
            type="button"
            data-testid="bt-empty-cta"
            onClick={onGoToGroups}
            className="mt-3 rounded bg-zinc-800 px-3 py-1.5 font-medium text-white"
          >
            Rellena primero el orden de los grupos
          </button>
        </div>
      </div>
    );
  }

  const selectedItems: SortableItem[] = selected.map((code) => {
    const isStale = staleByTeam.get(code);
    return {
      id: code,
      label: teamLabel.get(code)?.name ?? code,
      content: (
        <span className="flex flex-1 items-center justify-between gap-2">
          <span className="truncate">
            {label(code)}
            {isStale ? (
              <span
                data-testid={`bt-stale-badge-${code}`}
                className="ml-2 rounded bg-amber-100 px-1 text-xs font-medium text-amber-800"
              >
                inconsistente
              </span>
            ) : null}
          </span>
          <button
            type="button"
            data-testid={`bt-remove-${code}`}
            aria-label={`Quitar ${teamLabel.get(code)?.name ?? code}`}
            disabled={locked}
            onClick={() => remove(code)}
            className="min-h-[44px] shrink-0 rounded border border-zinc-300 px-2.5 text-xs disabled:opacity-30"
          >
            Quitar
          </button>
        </span>
      ),
    };
  });

  const emptySlots = Array.from(
    { length: Math.max(0, TOTAL_SLOTS - selected.length) },
    (_, i) => selected.length + i + 1,
  );

  return (
    <div
      data-testid="best-thirds-tab"
      className="flex flex-col gap-4 lg:flex-row lg:gap-8"
    >
      {/* Columna izquierda / arriba: candidatos */}
      <section
        className="flex flex-1 flex-col gap-2"
        data-testid="bt-candidates"
        onDragOver={(e) => {
          if (!locked) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (locked) {
            return;
          }
          const code = e.dataTransfer.getData(DRAG_MIME);
          if (code && selectedSet.has(code)) {
            remove(code);
          }
        }}
      >
        <h3 className="text-sm font-semibold text-zinc-700">
          Tus 12 terceros predichos
        </h3>
        <p className="text-xs text-zinc-500">
          Arrastra (o pulsa +) para añadirlos a la derecha.
        </p>
        <ul className="flex flex-wrap gap-2">
          {candidates.map((code) => {
            const isSelected = selectedSet.has(code);
            return (
              <li
                key={code}
                data-testid={`bt-candidate-${code}`}
                draggable={!locked && !isSelected}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, code);
                }}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-sm ${
                  isSelected
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border-zinc-300 bg-white cursor-grab'
                }`}
              >
                <span className="truncate">{label(code)}</span>
                <button
                  type="button"
                  data-testid={`bt-candidate-add-${code}`}
                  aria-label={`Añadir ${teamLabel.get(code)?.name ?? code}`}
                  disabled={locked || isSelected || selected.length >= TOTAL_SLOTS}
                  onClick={() => add(code)}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded border border-zinc-300 disabled:opacity-30"
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Columna derecha / abajo: los 8 ordenados */}
      <section
        className="flex flex-1 flex-col gap-2"
        data-testid="bt-selected-zone"
        onDragOver={(e) => {
          if (!locked) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (locked) {
            return;
          }
          const code = e.dataTransfer.getData(DRAG_MIME);
          if (code && !selectedSet.has(code)) {
            add(code);
          }
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
          <h3 className="text-sm font-semibold text-zinc-700">
            Los 8 que pasan a 1/16, en este orden
          </h3>
          <AutoSaveStatus status={status} locked={locked} onRetry={retry} />
        </div>

        <Indicator
          locked={locked}
          selectedCount={selected.length}
          staleCount={stale.length}
        />

        {selectedItems.length > 0 ? (
          <SortableList
            items={selectedItems}
            onReorder={reorder}
            disabled={locked}
            testIdPrefix="bt-selected"
            ariaLabel="Orden de los mejores terceros"
          />
        ) : null}

        <ol className="flex flex-col gap-1">
          {emptySlots.map((pos) => (
            <li
              key={`empty-${pos}`}
              data-testid={`bt-slot-empty-${pos}`}
              className="flex items-center gap-2 rounded border border-dashed border-zinc-300 px-2 py-1.5 text-sm text-zinc-400"
            >
              <span className="w-5 shrink-0 text-right font-semibold tabular-nums">
                {pos}.
              </span>
              <span>Vacío</span>
            </li>
          ))}
        </ol>

        {stale.length > 0 ? (
          <div
            data-testid="bt-stale-list"
            className="mt-2 flex flex-col gap-2 rounded border border-amber-300 bg-amber-50 p-2"
          >
            <p className="text-xs font-medium text-amber-800">
              Estas selecciones ya no son el 3.º de su grupo. Revísalas:
            </p>
            {stale.map((s) => {
              const replacement = s.replacement;
              return (
                <div
                  key={s.teamCode}
                  data-testid={`bt-stale-${s.teamCode}`}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="font-medium">{label(s.teamCode)}</span>
                  {replacement ? (
                    <button
                      type="button"
                      data-testid={`bt-stale-replace-${s.teamCode}`}
                      disabled={locked}
                      onClick={() => replace(s.teamCode, replacement)}
                      className="min-h-[44px] rounded border border-amber-400 px-2.5 disabled:opacity-30"
                    >
                      Sustituir por {label(replacement)} (grupo {s.groupLetter})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    data-testid={`bt-stale-remove-${s.teamCode}`}
                    disabled={locked}
                    onClick={() => remove(s.teamCode)}
                    className="min-h-[44px] rounded border border-amber-400 px-2.5 disabled:opacity-30"
                  >
                    Quitar de la selección
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Indicator({
  locked,
  selectedCount,
  staleCount,
}: {
  locked: boolean;
  selectedCount: number;
  staleCount: number;
}) {
  if (locked) {
    return null;
  }
  if (staleCount > 0) {
    return (
      <p
        data-testid="bt-indicator"
        className="text-xs font-medium text-amber-700"
      >
        REVISAR — {staleCount} {staleCount === 1 ? 'selección' : 'selecciones'}{' '}
        {staleCount === 1 ? 'inconsistente' : 'inconsistentes'}
      </p>
    );
  }
  if (selectedCount < TOTAL_SLOTS) {
    return (
      <p data-testid="bt-indicator" className="text-xs font-medium text-zinc-600">
        INCOMPLETA — faltan {TOTAL_SLOTS - selectedCount}
      </p>
    );
  }
  return (
    <p data-testid="bt-indicator" className="text-xs font-medium text-green-600">
      Completa
    </p>
  );
}

function AutoSaveStatus({
  status,
  locked,
  onRetry,
}: {
  status: ReturnType<typeof useAutoSave>['status'];
  locked: boolean;
  onRetry: () => void;
}) {
  if (locked) {
    return <span className="text-xs font-medium text-amber-700">BLOQUEADA</span>;
  }
  if (status === 'saving') {
    return (
      <span data-testid="bt-autosave-status" className="text-xs text-zinc-500">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="bt-autosave-status" className="text-xs text-green-600">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="bt-autosave-status"
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
    <span data-testid="bt-autosave-status" className="text-xs text-zinc-400">
      Sin cambios
    </span>
  );
}
