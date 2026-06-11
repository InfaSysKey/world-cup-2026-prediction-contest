'use client';

import * as React from 'react';

import { Cromo } from '@/components/porra/cromo';
import { ScoreField } from '@/components/porra/score-field';
import { cn } from '@/lib/utils';

// Tarjeta de partido como DUELO (design-system 10.3, mockup cromos-v2): grid de
// tres columnas local | marcador | visitante, con bandera + nombre centrados a
// cada lado y dos inputs grandes con el "–" de protagonista. Sirve a /porra
// (editable, value/onChange) y a /admin/partidos (form, name/defaultValue): cada
// pantalla pasa el wiring de sus inputs por homeInput/awayInput.
//
// La bandera es un slot opcional (hoy emoji; 10.4 mete <Flag> sin tocar esto).
// placed: colocado → cromo sólido con "✓ colocado"; vacío → hueco discontinuo.

type DuelTeam = {
  name: string;
  flag?: React.ReactNode;
};

// Los slots de input aceptan también atributos data-* (testids del e2e): en un
// literal de objeto no aplica el bypass de guion de JSX, así que se declara la
// firma de índice explícitamente.
type DuelInputProps = React.ComponentProps<'input'> & {
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
};

type Props = Omit<React.ComponentProps<'div'>, 'children'> & {
  placed: boolean;
  home: DuelTeam;
  away: DuelTeam;
  homeInput: DuelInputProps;
  awayInput: DuelInputProps;
  number?: string;
  placedStatus?: React.ReactNode;
};

function TeamColumn({ team }: { team: DuelTeam }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {team.flag}
      <span className="line-clamp-2 max-w-[96px] text-[13px] leading-tight font-medium break-words text-ink">
        {team.name}
      </span>
    </div>
  );
}

export function MatchDuel({
  placed,
  home,
  away,
  homeInput,
  awayInput,
  number,
  placedStatus,
  className,
  ...rest
}: Props) {
  // "Settle" al colocar (§6): cuando el partido pasa de hueco a colocado, la carta
  // hace un scale 0.96→1 una sola vez. Se desactiva con prefers-reduced-motion.
  const [settling, setSettling] = React.useState(false);
  const wasPlaced = React.useRef(placed);
  React.useEffect(() => {
    const justPlaced = placed && !wasPlaced.current;
    wasPlaced.current = placed;
    if (
      justPlaced &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setSettling(true);
      const timer = setTimeout(() => setSettling(false), 200);
      return () => clearTimeout(timer);
    }
  }, [placed]);

  return (
    <Cromo
      variant={placed ? 'normal' : 'slot'}
      number={number}
      status={placed ? (placedStatus ?? '✓ colocado') : undefined}
      className={cn(settling && 'cromo-settle', className)}
      {...rest}
      data-placed={placed}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <TeamColumn team={home} />
        <div className="flex items-center justify-center gap-1.5">
          <ScoreField placed={placed} {...homeInput} />
          <span className="select-none text-[19px] font-semibold text-ink-muted">
            –
          </span>
          <ScoreField placed={placed} {...awayInput} />
        </div>
        <TeamColumn team={away} />
      </div>
    </Cromo>
  );
}
