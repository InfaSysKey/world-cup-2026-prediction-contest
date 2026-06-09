'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

// Barra de navegación de las páginas autenticadas (slice 7.5). Client component
// solo para resaltar el enlace activo (usePathname). El indicador de bloqueo y
// los datos del usuario los calcula el layout en servidor y se pasan como props.

export type LockIndicator = {
  locked: boolean;
  remaining: number;
};

type Props = {
  nickname: string;
  isAdmin: boolean;
  lock: LockIndicator;
};

const LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/clasificacion', label: 'Clasificación' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/mi-porra', label: 'Mi porra' },
  { href: '/porra', label: 'Rellenar' },
];

function lockMessage(lock: LockIndicator): string {
  if (lock.locked) {
    return 'Tu porra está bloqueada';
  }
  if (lock.remaining === 0) {
    return 'Tu porra se bloquea al empezar el torneo';
  }
  return `Faltan ${lock.remaining} partido${lock.remaining === 1 ? '' : 's'} para que se bloquee tu porra`;
}

export function PorraNav({ nickname, isAdmin, lock }: Props) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slot bg-surface">
      <nav className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <span className="font-display text-lg font-semibold text-ink">
          Porra 2026
        </span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'hover:underline',
                    active
                      ? 'font-semibold text-cromo-cobalt'
                      : 'text-ink-muted',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          {isAdmin ? (
            <li>
              <Link
                href="/admin/invitaciones"
                className="text-ink-muted hover:underline"
              >
                Admin
              </Link>
            </li>
          ) : null}
        </ul>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeToggle />
          <span className="text-ink-muted">{nickname}</span>
          <form action="/logout" method="post">
            <button type="submit" className="font-medium text-ink underline">
              Salir
            </button>
          </form>
        </div>
      </nav>
      <div
        className={cn(
          'px-3 py-1.5 text-center text-xs',
          lock.locked
            ? 'bg-muted text-ink-muted'
            : 'bg-amber-400/10 text-amber-700 dark:text-amber-300',
        )}
      >
        {lockMessage(lock)}
      </div>
    </header>
  );
}
