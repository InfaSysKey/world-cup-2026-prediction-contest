import { and, gt, isNotNull, isNull, sql } from 'drizzle-orm';

import { MATCHES_TOTAL } from '@/lib/constants';
import { db, invitations, matches, users } from '@/lib/db';

export default async function AdminDashboardPage() {
  const now = new Date();
  const countExpr = sql<number>`count(*)::int`;

  const [usersRow] = await db.select({ n: countExpr }).from(users);
  const [activeInvRow] = await db
    .select({ n: countExpr })
    .from(invitations)
    .where(and(isNull(invitations.usedBy), gt(invitations.expiresAt, now)));
  const [matchesWithResultRow] = await db
    .select({ n: countExpr })
    .from(matches)
    .where(isNotNull(matches.realGolesLocal));

  const cards = [
    { label: 'Usuarios registrados', value: usersRow.n },
    { label: 'Invitaciones activas', value: activeInvRow.n },
    {
      label: 'Partidos con resultado',
      value: `${matchesWithResultRow.n} / ${MATCHES_TOTAL}`,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Resumen</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-1 rounded border border-slot p-4"
          >
            <span className="text-2xl font-semibold">{card.value}</span>
            <span className="text-sm text-ink-muted">{card.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
