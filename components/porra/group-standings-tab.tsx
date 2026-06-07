'use client';

import { useCallback, useMemo, useState } from 'react';

import { saveGroupStandings } from '@/app/(porra)/porra/actions';
import type {
  GroupTeam,
  GroupTeamsCatalog,
} from '@/app/(porra)/porra/load-group-teams';
import { SortableList, type SortableItem } from '@/components/porra/sortable-list';
import type { PredictionGroupStanding } from '@/lib/db';
import { useAutoSave } from '@/lib/hooks/use-auto-save';

// Forma plana del batch que se manda a la Server Action. No reutilizamos el tipo
// derivado del enum del validador (groupLetter sería un literal A–L) porque aquí
// la letra viene del catálogo como string; el servidor revalida con Zod.
type StandingEntry = { groupLetter: string; position: number; teamCode: string };

type GroupStandingsTabProps = {
  catalog: GroupTeamsCatalog[];
  initial: PredictionGroupStanding[];
  // Bloques de equipos empatados a puntos por grupo, calculados en vivo por el
  // contenedor a partir de los marcadores predichos. Solo se rellenan cuando el
  // grupo está completo; un grupo sin empate o incompleto trae [].
  tiedBlocksByGroup: Record<string, string[][]>;
  locked: boolean;
};

type Orders = Record<string, string[]>;

function buildInitialOrders(
  catalog: GroupTeamsCatalog[],
  initial: PredictionGroupStanding[],
): { orders: Orders; answered: Set<string> } {
  const savedByGroup = new Map<string, PredictionGroupStanding[]>();
  for (const s of initial) {
    const list = savedByGroup.get(s.groupLetter) ?? [];
    list.push(s);
    savedByGroup.set(s.groupLetter, list);
  }

  const orders: Orders = {};
  const answered = new Set<string>();
  for (const group of catalog) {
    const saved = savedByGroup.get(group.groupLetter);
    if (saved && saved.length === group.teams.length) {
      orders[group.groupLetter] = [...saved]
        .sort((a, b) => a.position - b.position)
        .map((s) => s.teamCode);
      answered.add(group.groupLetter);
    } else {
      // Orden por defecto = orden del catálogo; no se considera respondido hasta
      // que el usuario lo toque.
      orders[group.groupLetter] = group.teams.map((t) => t.code);
    }
  }
  return { orders, answered };
}

// Reordena, dentro del orden completo, solo los equipos de un bloque empatado,
// respetando las posiciones que ese bloque ya ocupa (los demás no se mueven).
function applyTiebreakOrder(
  currentOrder: string[],
  newBlockOrder: string[],
): string[] {
  const blockSet = new Set(newBlockOrder);
  const slots = currentOrder
    .map((code, idx) => ({ code, idx }))
    .filter(({ code }) => blockSet.has(code))
    .map(({ idx }) => idx);

  const result = [...currentOrder];
  slots.forEach((slot, k) => {
    result[slot] = newBlockOrder[k];
  });
  return result;
}

function toBatch(
  orders: Orders,
  answered: Set<string>,
): StandingEntry[] {
  const out: StandingEntry[] = [];
  for (const groupLetter of answered) {
    orders[groupLetter]?.forEach((teamCode, idx) => {
      out.push({ groupLetter, position: idx + 1, teamCode });
    });
  }
  return out;
}

export function GroupStandingsTab({
  catalog,
  initial,
  tiedBlocksByGroup,
  locked,
}: GroupStandingsTabProps) {
  const init = useMemo(
    () => buildInitialOrders(catalog, initial),
    [catalog, initial],
  );
  const [orders, setOrders] = useState<Orders>(init.orders);
  const [answered, setAnswered] = useState<Set<string>>(init.answered);

  const teamLabel = useMemo(() => {
    const map = new Map<string, GroupTeam>();
    for (const group of catalog) {
      for (const team of group.teams) {
        map.set(team.code, team);
      }
    }
    return map;
  }, [catalog]);

  const onSave = useCallback(
    async (batch: StandingEntry[]) => {
      const res = await saveGroupStandings(batch);
      if (res.error) {
        throw new Error(res.error.message);
      }
    },
    [],
  );

  const { status, save, retry } = useAutoSave(onSave);

  function commit(nextOrders: Orders, group: string) {
    const nextAnswered = new Set(answered).add(group);
    setOrders(nextOrders);
    setAnswered(nextAnswered);
    save(toBatch(nextOrders, nextAnswered));
  }

  function handleReorder(group: string, orderedIds: string[]) {
    commit({ ...orders, [group]: orderedIds }, group);
  }

  function handleTiebreak(group: string, newBlockOrder: string[]) {
    const next = applyTiebreakOrder(orders[group] ?? [], newBlockOrder);
    commit({ ...orders, [group]: next }, group);
  }

  function itemsFor(codes: string[]): SortableItem[] {
    return codes.map((code) => {
      const team = teamLabel.get(code);
      return {
        id: code,
        content: team ? `${team.flag} ${team.name}` : code,
      };
    });
  }

  return (
    <div data-testid="group-standings-tab" className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-2">
        <p className="text-sm text-zinc-500">
          Arrastra cada equipo a su posición final (1.º a 4.º) en el grupo.
        </p>
        <AutoSaveStatus status={status} locked={locked} onRetry={retry} />
      </div>

      {catalog.map((group) => {
        const order = orders[group.groupLetter] ?? [];
        const tiedBlocks = tiedBlocksByGroup[group.groupLetter] ?? [];
        return (
          <section
            key={group.groupLetter}
            data-testid={`gs-group-${group.groupLetter}`}
            className="flex flex-col gap-2"
          >
            <h3 className="text-sm font-semibold text-zinc-700">
              Grupo {group.groupLetter}
            </h3>

            <SortableList
              items={itemsFor(order)}
              onReorder={(ids) => handleReorder(group.groupLetter, ids)}
              disabled={locked}
              testIdPrefix={`gs-order-${group.groupLetter}`}
              ariaLabel={`Orden del grupo ${group.groupLetter}`}
            />

            {tiedBlocks.map((block, i) => (
              <div
                key={`${group.groupLetter}-tie-${i}`}
                data-testid={`gs-tiebreak-${group.groupLetter}-${i}`}
                className="rounded border border-amber-300 bg-amber-50 p-2"
              >
                <p className="mb-1 text-xs font-medium text-amber-800">
                  Desempate — tus marcadores empatan a puntos a estos equipos.
                  Ordénalos según tu preferencia.
                </p>
                <SortableList
                  items={itemsFor(
                    // Mantén los equipos del bloque en su orden actual del grupo.
                    order.filter((code) => block.includes(code)),
                  )}
                  onReorder={(ids) =>
                    handleTiebreak(group.groupLetter, ids)
                  }
                  disabled={locked}
                  showPositions={false}
                  testIdPrefix={`gs-tie-${group.groupLetter}-${i}`}
                  ariaLabel={`Desempate del grupo ${group.groupLetter}`}
                />
              </div>
            ))}
          </section>
        );
      })}
    </div>
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
      <span data-testid="gs-autosave-status" className="text-xs text-zinc-500">
        Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span data-testid="gs-autosave-status" className="text-xs text-green-600">
        Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        data-testid="gs-autosave-status"
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
    <span data-testid="gs-autosave-status" className="text-xs text-zinc-400">
      Sin cambios
    </span>
  );
}
