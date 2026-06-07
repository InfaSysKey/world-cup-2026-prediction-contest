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
};

type SortableListProps = {
  items: SortableItem[];
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
  showPositions?: boolean;
  testIdPrefix?: string;
  ariaLabel?: string;
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
      {items.map((item, index) => (
        <li
          key={item.id}
          data-testid={`${testIdPrefix}-item-${item.id}`}
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
          className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${
            disabled
              ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
              : 'border-zinc-300 bg-white cursor-grab'
          } ${dragIndex === index ? 'opacity-50' : ''}`}
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
              aria-label={`Subir ${item.id}`}
              onClick={() => reorder(index, index - 1)}
              className="rounded border border-zinc-300 px-1.5 leading-none disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={disabled || index === items.length - 1}
              data-testid={`${testIdPrefix}-down-${item.id}`}
              aria-label={`Bajar ${item.id}`}
              onClick={() => reorder(index, index + 1)}
              className="rounded border border-zinc-300 px-1.5 leading-none disabled:opacity-30"
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
