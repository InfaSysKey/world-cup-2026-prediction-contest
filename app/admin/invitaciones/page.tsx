import { db } from '@/lib/db';

import { InvitacionesForm } from './invitaciones-form';

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

type InvitationStatus = 'activa' | 'usada' | 'caducada';

function statusOf(
  invitation: { usedBy: number | null; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (invitation.usedBy !== null) {
    return 'usada';
  }
  return invitation.expiresAt > now ? 'activa' : 'caducada';
}

export default async function InvitacionesPage() {
  const now = new Date();
  const list = await db.query.invitations.findMany({
    orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    columns: {
      id: true,
      note: true,
      usedBy: true,
      expiresAt: true,
      createdAt: true,
    },
    with: { usedByUser: { columns: { nickname: true } } },
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Invitaciones</h1>
      <p className="text-sm text-zinc-600">
        Genera un enlace de un solo uso. Se muestra una vez: cópialo y envíalo.
        Por seguridad, el enlace no se vuelve a mostrar después.
      </p>
      <InvitacionesForm />

      <table className="w-full max-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-600">
            <th className="py-2 pr-4 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Nota</th>
            <th className="py-2 pr-4 font-medium">Estado</th>
            <th className="py-2 pr-4 font-medium">Usada por</th>
            <th className="py-2 pr-4 font-medium">Caduca</th>
          </tr>
        </thead>
        <tbody>
          {list.map((inv) => (
            <tr
              key={inv.id}
              data-testid={`invitation-row-${inv.id}`}
              className="border-b border-zinc-100"
            >
              <td className="py-2 pr-4">{inv.id}</td>
              <td className="py-2 pr-4">{inv.note ?? '—'}</td>
              <td className="py-2 pr-4">{statusOf(inv, now)}</td>
              <td className="py-2 pr-4">{inv.usedByUser?.nickname ?? '—'}</td>
              <td className="py-2 pr-4">{dateFormat.format(inv.expiresAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
