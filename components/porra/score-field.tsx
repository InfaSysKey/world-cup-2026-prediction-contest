import * as React from 'react';

import { MAX_GOLES } from '@/lib/constants';
import { cn } from '@/lib/utils';

// Input de marcador del duelo (design-system 10.3, mockup cromos-v2): caja grande
// mono, foco = borde cobalto + anillo + leve scale. `placed=false` lo pinta
// discontinuo (el hueco aún sin rellenar). Hace spread de props para servir
// tanto al formulario editable (value/onChange) como al de admin (name/defaultValue).
// El foco de teclado mantiene además el outline global (quality floor §8); el
// scale se desactiva con prefers-reduced-motion.

type Props = React.ComponentProps<'input'> & { placed?: boolean };

export function ScoreField({ placed = true, className, ...props }: Props) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_GOLES}
      className={cn(
        'h-14 w-12 rounded-[14px] border-[1.5px] bg-bg text-center font-mono text-[25px] font-semibold tabular-nums text-ink transition-[transform,box-shadow,border-color] duration-150 focus:scale-105 focus:border-cromo-cobalt focus:ring-4 focus:ring-cromo-cobalt/20 disabled:opacity-50 motion-reduce:transition-none motion-reduce:focus:scale-100',
        placed ? 'border-slot' : 'border-dashed border-slot bg-transparent',
        className,
      )}
      {...props}
    />
  );
}
