import Link from 'next/link';

import { AppHeader } from '@/components/porra/app-header';
import { requireAdmin } from '@/lib/auth/require-admin';

const NAV = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/invitaciones', label: 'Invitaciones' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/partidos', label: 'Partidos' },
  { href: '/admin/clasificaciones', label: 'Clasificaciones' },
] as const;

// El admin también juega: ve la cabecera de jugador (con vuelta a la porra y
// toggle de tema) y, debajo, su propia sub-nav de administración (slice 10.1).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader nickname={user.nickname} isAdmin />
      <header className="flex flex-col gap-2 border-b border-slot px-6 py-3">
        <span className="text-eyebrow">Administración</span>
        <nav className="flex flex-wrap gap-4 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink-muted hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
