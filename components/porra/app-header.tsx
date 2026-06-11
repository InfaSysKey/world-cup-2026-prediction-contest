'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AccountMenu } from '@/components/porra/account-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

// Cabecera persistente de TODAS las páginas autenticadas, incluido /admin
// (slice 10.1). Antes /admin no heredaba el layout de (porra) por ser hermano
// del route group, así que se quedaba sin nav de jugador, sin toggle y sin
// vuelta a la porra. Este componente lo renderizan ambos layouts.
//
// Replica el mockup (docs/ref/mockup-cromos-v2.html): marca "Porra 26" con el
// punto de acento, enlaces con estado activo, toggle de tema y menú de cuenta.
// Responsive a 320px: marca y controles fijos; los enlaces hacen scroll
// horizontal si no caben, sin que la página llegue a desbordarse.

type Props = {
  nickname: string;
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  match?: readonly string[];
};

// "Mi porra" apunta al álbum editable /porra (decisión Q1); se resalta también
// en la vista de solo lectura /mi-porra.
const LINKS: readonly NavItem[] = [
  { href: '/clasificacion', label: 'Clasificación' },
  { href: '/porra', label: 'Mi porra', match: ['/mi-porra'] },
  { href: '/partidos', label: 'Partidos' },
];

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
  admin = false,
}: {
  href: string;
  label: string;
  active: boolean;
  admin?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-11 shrink-0 items-center rounded-[10px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
        admin
          ? 'text-cromo-cobalt hover:text-cromo-cobalt'
          : 'text-ink-muted hover:text-ink',
        active && 'bg-ink/7',
        active && !admin && 'text-ink',
      )}
    >
      {label}
    </Link>
  );
}

export function AppHeader({ nickname, isAdmin }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-ink/7 bg-bg/85 backdrop-blur-md backdrop-saturate-150">
      <nav className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-2">
        <Link
          href="/clasificacion"
          className="mr-1 flex shrink-0 items-center gap-2 font-display text-[19px] font-bold tracking-[-0.02em] whitespace-nowrap text-ink"
        >
          <span
            aria-hidden
            className="size-[9px] shrink-0 rounded-full"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--cromo-coral), var(--cromo-gold))',
            }}
          />
          Porra 26
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={
                matchesPath(pathname, item.href) ||
                (item.match?.some((m) => matchesPath(pathname, m)) ?? false)
              }
            />
          ))}
          {isAdmin ? (
            <NavLink
              href="/admin"
              label="Admin"
              admin
              active={matchesPath(pathname, '/admin')}
            />
          ) : null}
        </div>

        <ThemeToggle className="shrink-0" />
        <AccountMenu nickname={nickname} className="shrink-0" />
      </nav>
    </header>
  );
}
