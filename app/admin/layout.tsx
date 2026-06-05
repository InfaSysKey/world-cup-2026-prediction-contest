import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 px-6 py-3">
        <span className="text-sm font-semibold">Administración · Porra 2026</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
