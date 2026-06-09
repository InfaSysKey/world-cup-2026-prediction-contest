import Link from 'next/link';

import { requireAdmin } from '@/lib/auth/require-admin';

const NAV = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/invitaciones', label: 'Invitaciones' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/partidos', label: 'Partidos' },
  { href: '/admin/clasificaciones', label: 'Clasificaciones' },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-slot px-6 py-3">
        <span className="text-sm font-semibold">Administración · Porra 2026</span>
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
