import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/porra/app-header';
import { LockBar } from '@/components/porra/lock-bar';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadMatchScheduledTimes } from '@/lib/db/match-times';
import { matchesUntilLock } from '@/lib/scoring/lock-countdown';
import { tournamentStartAt } from '@/lib/scoring/locks';

// Layout de las rutas autenticadas (grupo (porra)). Resuelve el usuario una vez,
// calcula el indicador de bloqueo en servidor y envuelve cada página con la
// cabecera compartida (slice 10.1) + la tira de bloqueo, propia de jugador.
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
      <AppHeader nickname={user.nickname} isAdmin={user.isAdmin} />
      <LockBar lock={lock} />
      {children}
    </>
  );
}
