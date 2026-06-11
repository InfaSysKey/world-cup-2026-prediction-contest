"use client";

import { useLayoutEffect, useRef } from "react";

import { Cromo } from "@/components/porra/cromo";
import { FoilCromo } from "@/components/porra/foil-cromo";
import { PlayerAvatar } from "@/components/porra/player-avatar";
import type { ScoreCategory } from "@/lib/db";
import { cn } from "@/lib/utils";

export type BoardPlayer = {
  userId: number;
  nickname: string;
  rank: number;
  needsDraw: boolean;
  totalPoints: number;
  categoryPoints: Partial<Record<ScoreCategory, number>> | undefined;
  // Posiciones ganadas (>0) o perdidas (<0) desde el recálculo previo; null/0 = sin cambio.
  delta?: number | null;
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

function PointsBadge({
  value,
  delta,
}: {
  value: number;
  delta?: number | null;
}) {
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="text-data font-semibold tabular-nums">{value}</span>
      {delta != null && delta !== 0 ? (
        <span
          className={cn(
            "text-[10.5px] font-semibold tabular-nums",
            delta > 0 ? "text-cromo-mint" : "text-cromo-coral",
          )}
          aria-label={
            delta > 0
              ? `Sube ${delta} ${delta === 1 ? "posición" : "posiciones"}`
              : `Baja ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "posición" : "posiciones"}`
          }
        >
          {delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
        </span>
      ) : null}
    </span>
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

// Fila de cromo normal del ranking (#2 en adelante). tint pinta el metálico sutil
// de plata/bronce para el podio (#2/#3); sin tint = cromo normal (#4+).
function RankRow({
  player,
  meId,
  tint,
}: {
  player: BoardPlayer;
  meId: number;
  tint?: "silver" | "bronze";
}) {
  return (
    <Cromo
      variant="normal"
      data-testid="ranking-row"
      data-flip-id={String(player.userId)}
      className={cn(
        "flex items-center gap-3",
        tint === "silver" && "cromo-silver",
        tint === "bronze" && "cromo-bronze",
        player.userId === meId &&
          "outline outline-2 outline-offset-2 outline-cromo-cobalt",
      )}
    >
      <span
        data-testid="ranking-rank"
        className={cn(
          "text-cromo-num text-2xl",
          tint === "silver"
            ? "text-[var(--silver)]"
            : tint === "bronze"
              ? "text-[var(--bronze)]"
              : "text-ink-muted",
        )}
      >
        {player.rank}
      </span>
      <PlayerAvatar nick={player.nickname} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{player.nickname}</span>
        {player.needsDraw ? (
          <span className="mt-0.5">
            <TieBadge />
          </span>
        ) : null}
      </div>
      <PointsBadge value={player.totalPoints} delta={player.delta} />
    </Cromo>
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
  const medals = rest.slice(0, 2);
  const others = rest.slice(2);

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-3">
      {/* #1 — foil con corona; el shiny se reserva al líder (§3, §4) */}
      <FoilCromo
        crown
        data-testid="ranking-row"
        data-flip-id={String(leader.userId)}
        className={cn(
          leader.userId === meId &&
            "outline outline-2 outline-offset-2 outline-cromo-cobalt",
        )}
      >
        <div className="flex items-center gap-4">
          <span
            data-testid="ranking-rank"
            className="text-cromo-num text-4xl text-cromo-gold"
          >
            {leader.rank}
          </span>
          <PlayerAvatar nick={leader.nickname} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-display-l truncate">{leader.nickname}</span>
            {leader.needsDraw ? (
              <span className="mt-1">
                <TieBadge />
              </span>
            ) : null}
          </div>
          <PointsBadge value={leader.totalPoints} delta={leader.delta} />
        </div>
      </FoilCromo>

      {/* #2 y #3 — medallas plata y bronce (metálico sutil, no holo) (§3) */}
      {medals.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {medals.map((p, i) => (
            <RankRow
              key={p.userId}
              player={p}
              meId={meId}
              tint={i === 0 ? "silver" : "bronze"}
            />
          ))}
        </div>
      ) : null}

      {/* #4 en adelante — cuadrícula de cromos normales (§3) */}
      {others.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {others.map((p) => (
            <RankRow key={p.userId} player={p} meId={meId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
