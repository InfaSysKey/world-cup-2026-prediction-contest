import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/current-user';

// Placeholder protegido; el formulario real de la porra es el slice 4.
export default async function PorraPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Hola, {user.nickname}</h1>
      <p className="text-zinc-600">Aquí irá tu porra. Próximamente.</p>
      <div className="flex gap-4">
        {user.isAdmin ? (
          <a href="/admin/invitaciones" className="text-sm font-medium underline">
            Administrar
          </a>
        ) : null}
        <form action="/logout" method="post">
          <button type="submit" className="text-sm font-medium underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
