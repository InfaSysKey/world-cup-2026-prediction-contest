import { redirect } from 'next/navigation';

import { PorraNav } from '@/components/porra/porra-nav';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadMatchScheduledTimes } from '@/lib/db/match-times';
import { matchesUntilLock } from '@/lib/scoring/lock-countdown';
import { tournamentStartAt } from '@/lib/scoring/locks';

// Layout de las rutas autenticadas (grupo (porra)). Resuelve el usuario una vez,
// calcula el indicador de bloqueo en servidor y envuelve cada página con la
// navbar compartida (slice 7.5).
export default async function PorraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const matchTimes = await loadMatchScheduledTimes();
  const lock = matchesUntilLock(matchTimes, new Date(), tournamentStartAt());

  return (
    <>
      <PorraNav nickname={user.nickname} isAdmin={user.isAdmin} lock={lock} />
      {children}
    </>
  );
}
