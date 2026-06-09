"use client";

import { useLayoutEffect, useRef } from "react";

import { Cromo } from "@/components/porra/cromo";
import type { ScoreCategory } from "@/lib/db";
import { cn } from "@/lib/utils";

export type BoardPlayer = {
  userId: number;
  nickname: string;
  rank: number;
  needsDraw: boolean;
  totalPoints: number;
  categoryPoints: Partial<Record<ScoreCategory, number>> | undefined;
};

type Props = {
  players: BoardPlayer[];
  meId: number;
};

// Reordenación con FLIP (§6): cuando cambian las posiciones, las cartas se
// deslizan a su nuevo sitio en vez de saltar. Se desactiva con reduce-motion.
function useFlip(order: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nodes = container.querySelectorAll<HTMLElement>("[data-flip-id]");
    const nextRects = new Map<string, DOMRect>();

    nodes.forEach((node) => {
      const id = node.dataset.flipId;
      if (!id) return;
      const rect = node.getBoundingClientRect();
      nextRects.set(id, rect);

      const prev = prevRects.current.get(id);
      if (prev && !reduce) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        if (dx !== 0 || dy !== 0) {
          node.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        }
      }
    });

    prevRects.current = nextRects;
  }, [order]);

  return containerRef;
}

function PointsBadge({ value }: { value: number }) {
  return (
    <span className="text-data font-semibold tabular-nums">{value}</span>
  );
}

function TieBadge() {
  return (
    <span
      className="rounded-md bg-cromo-coral/15 px-1.5 py-0.5 text-xs font-medium text-cromo-coral"
      title="Empate sin resolver: pendiente de sorteo público"
    >
      empate
    </span>
  );
}

export function RankingBoard({ players, meId }: Props) {
  const order = players.map((p) => p.userId).join(",");
  const containerRef = useFlip(order);

  if (players.length === 0) {
    return (
      <Cromo variant="empty" className="min-h-32 w-full text-center">
        <span className="text-ink-muted">
          Aún no hay cromos en la clasificación. En cuanto entren los primeros
          resultados, esto se llena.
        </span>
      </Cromo>
    );
  }

  const [leader, ...rest] = players;

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-3">
      {/* #1 — cromo foil a ancho completo (§3) */}
      <Cromo
        variant="foil"
        data-testid="ranking-row"
        data-flip-id={String(leader.userId)}
        className={cn(
          "flex items-center gap-4",
          leader.userId === meId && "ring-2 ring-cromo-cobalt",
        )}
      >
        <span
          data-testid="ranking-rank"
          className="text-cromo-num text-3xl text-cromo-gold"
        >
          ✦{leader.rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-display-l truncate">{leader.nickname}</span>
          {leader.needsDraw ? (
            <span className="mt-1">
              <TieBadge />
            </span>
          ) : null}
        </div>
        <PointsBadge value={leader.totalPoints} />
      </Cromo>

      {/* Del 2 en adelante — cuadrícula de cromos normales (§3) */}
      {rest.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rest.map((p) => (
            <Cromo
              key={p.userId}
              variant="normal"
              data-testid="ranking-row"
              data-flip-id={String(p.userId)}
              className={cn(
                "flex items-center gap-3",
                p.userId === meId && "ring-2 ring-cromo-cobalt",
              )}
            >
              <span
                data-testid="ranking-rank"
                className="text-cromo-num text-2xl text-ink-muted"
              >
                {p.rank}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{p.nickname}</span>
                {p.needsDraw ? (
                  <span className="mt-0.5">
                    <TieBadge />
                  </span>
                ) : null}
              </div>
              <PointsBadge value={p.totalPoints} />
            </Cromo>
          ))}
        </div>
      ) : null}
    </div>
  );
}
