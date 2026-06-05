import { db } from '@/lib/db';

const dateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
});

export default async function UsuariosPage() {
  const all = await db.query.users.findMany({
    orderBy: (u, { asc }) => [asc(u.createdAt)],
    columns: {
      id: true,
      nickname: true,
      email: true,
      nombre: true,
      apellidos: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Usuarios</h1>
      <p className="text-sm text-zinc-600">{all.length} registrados.</p>
      <table className="w-full max-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-600">
            <th className="py-2 pr-4 font-medium">Nick</th>
            <th className="py-2 pr-4 font-medium">Nombre</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Alta</th>
          </tr>
        </thead>
        <tbody>
          {all.map((u) => (
            <tr key={u.id} className="border-b border-zinc-100">
              <td className="py-2 pr-4 font-medium">
                {u.nickname}
                {u.isAdmin ? (
                  <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
                    admin
                  </span>
                ) : null}
              </td>
              <td className="py-2 pr-4">
                {u.nombre} {u.apellidos}
              </td>
              <td className="py-2 pr-4">{u.email}</td>
              <td className="py-2 pr-4">{dateFormat.format(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
