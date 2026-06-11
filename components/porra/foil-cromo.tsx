'use client';

import { useRef, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Cromo FOIL: el shiny holográfico reservado al #1 (design-system §4, 10.5). El
// tilt 3D y el brillo siguen al puntero/dedo escribiendo `transform` y --mx/--my
// DIRECTAMENTE en el nodo por ref — nunca useState, o la clasificación iría a
// tirones por re-renders. La estructura y la animación están en .foil-* (globals).
// Pointer Events cubren ratón y táctil; sin preventDefault, así no secuestran el
// scroll. prefers-reduced-motion: sin tilt (la CSS ya congela giro y transición).

type Props = ComponentProps<'div'> & {
  children: ReactNode;
  crown?: boolean;
};

export function FoilCromo({
  children,
  crown = false,
  className,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function tilt(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
    el.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 16}deg) rotateX(${(0.5 - y) * 16}deg)`;
  }

  function reset() {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.transform = '';
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '40%');
  }

  return (
    <div
      ref={ref}
      className={cn('foil-card', className)}
      onPointerMove={(e) => tilt(e.clientX, e.clientY)}
      onPointerLeave={reset}
      onPointerCancel={reset}
      {...rest}
    >
      <div aria-hidden className="foil-holo" />
      <div className="foil-inner">{children}</div>
      {crown ? (
        <span aria-hidden className="foil-crown">
          👑
        </span>
      ) : null}
    </div>
  );
}
