'use client';

import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { PlayerAvatar } from '@/components/porra/player-avatar';
import { cn } from '@/lib/utils';

// Botón de cuenta de la cabecera: un avatar que despliega un menú con el nick y
// "Salir" (decisión Q1 del slice 10.1). El mockup no muestra logout en la barra,
// así que lo recogemos aquí para mantenerla limpia a 320px. Menú propio (sin
// dependencia nueva): cierra con click fuera y Escape, y devuelve el foco al
// disparador. El logout sigue siendo un POST a /logout (igual que antes).

type Props = {
  nickname: string;
  className?: string;
};

export function AccountMenu({ nickname, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${nickname}`}
        onClick={() => setOpen((value) => !value)}
        className="grid size-11 place-items-center rounded-full transition-transform active:scale-95"
      >
        <PlayerAvatar nick={nickname} size="md" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Cuenta"
          className="absolute right-0 z-40 mt-2 min-w-44 rounded-[14px] border border-slot bg-surface p-2 shadow-[var(--shadow-hi)]"
        >
          <div className="px-2 py-1.5">
            <p className="text-xs text-ink-muted">Tu cuenta</p>
            <p className="truncate font-display font-semibold text-ink">
              {nickname}
            </p>
          </div>
          <div className="my-1 h-px bg-slot" />
          <form action="/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              autoFocus
              className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-sm font-medium text-ink hover:bg-muted"
            >
              <LogOut className="size-4" />
              Salir
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
