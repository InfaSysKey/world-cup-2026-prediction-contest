'use client';

import { type ReactNode, useState } from 'react';

// Lista ordenable reutilizable (orden de grupo, desempate y más adelante mejores
// terceros). Drag nativo HTML5 + botones ↑/↓ para teclado y accesibilidad: no
// añade dependencias (CLAUDE.md §2/§10, decisión "drag nativo"). Es controlada:
// el padre tiene el orden en su estado y `onReorder` le devuelve el nuevo orden
// de ids para que lo persista.

export type SortableItem = {
  id: string;
  content: ReactNode;
  // Etiqueta accesible (nombre legible) para los botones ↑/↓; si falta, el id.
  label?: string;
};

type SortableListProps = {
  items: SortableItem[];
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
  showPositions?: boolean;
  testIdPrefix?: string;
  ariaLabel?: string;
  // Ids resaltados (p. ej. equipos empatados a desempatar). Reciben estilo ámbar
  // y data-tied="true" para que el orden que el usuario les dé aquí sea su
  // desempate, sin necesidad de un segundo control.
  highlightedIds?: ReadonlySet<string>;
};

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) {
    return arr;
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function SortableList({
  items,
  onReorder,
  disabled = false,
  showPositions = true,
  testIdPrefix = 'sortable',
  ariaLabel,
  highlightedIds,
}: SortableListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function reorder(from: number, to: number) {
    const next = move(items, from, to);
    if (next !== items) {
      onReorder(next.map((i) => i.id));
    }
  }

  return (
    <ol
      aria-label={ariaLabel}
      data-testid={testIdPrefix}
      className="flex flex-col gap-1"
    >
      {items.map((item, index) => {
        const highlighted = highlightedIds?.has(item.id) ?? false;
        const tone = disabled
          ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
          : highlighted
            ? 'border-amber-300 bg-amber-50 text-amber-900 cursor-grab ring-1 ring-amber-300'
            : 'border-zinc-300 bg-white cursor-grab';
        return (
        <li
          key={item.id}
          data-testid={`${testIdPrefix}-item-${item.id}`}
          data-tied={highlighted ? 'true' : undefined}
          draggable={!disabled}
          aria-roledescription="elemento ordenable"
          onDragStart={() => setDragIndex(index)}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(e) => {
            if (disabled || dragIndex === null) {
              return;
            }
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (disabled || dragIndex === null) {
              return;
            }
            e.preventDefault();
            reorder(dragIndex, index);
            setDragIndex(null);
          }}
          className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${tone} ${dragIndex === index ? 'opacity-50' : ''}`}
        >
          {showPositions ? (
            <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-zinc-500">
              {index + 1}.
            </span>
          ) : null}
          <span aria-hidden className="shrink-0 select-none text-zinc-400">
            ⠿
          </span>
          <span className="flex-1 truncate">{item.content}</span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              disabled={disabled || index === 0}
              data-testid={`${testIdPrefix}-up-${item.id}`}
              aria-label={`Subir ${item.label ?? item.id}`}
              onClick={() => reorder(index, index - 1)}
              className="flex size-11 items-center justify-center rounded border border-zinc-300 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={disabled || index === items.length - 1}
              data-testid={`${testIdPrefix}-down-${item.id}`}
              aria-label={`Bajar ${item.label ?? item.id}`}
              onClick={() => reorder(index, index + 1)}
              className="flex size-11 items-center justify-center rounded border border-zinc-300 disabled:opacity-30"
            >
              ↓
            </button>
          </span>
        </li>
        );
      })}
    </ol>
  );
}
