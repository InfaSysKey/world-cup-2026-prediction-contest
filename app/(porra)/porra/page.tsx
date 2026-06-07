import { redirect } from 'next/navigation';

import { PorraStepper } from '@/components/porra/porra-stepper';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadAllLocks } from '@/lib/scoring/locks';

import { loadGroupMatches } from './load-group-matches';
import { loadGroupTeams } from './load-group-teams';
import { loadPodium } from './load-podium';
import { loadUserPredictions } from './load-predictions';

export default async function PorraPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [initialData, groupMatchesCatalog, groupTeamsCatalog, podiumData] =
    await Promise.all([
      loadUserPredictions(user.id),
      loadGroupMatches(),
      loadGroupTeams(),
      loadPodium(user.id),
    ]);
  const locks = loadAllLocks();

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <header className="flex w-full max-w-3xl items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hola, {user.nickname}</h1>
        <div className="flex items-center gap-4">
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
      </header>

      <PorraStepper
        initialData={initialData}
        locks={locks}
        groupMatchesCatalog={groupMatchesCatalog}
        groupTeamsCatalog={groupTeamsCatalog}
        podium={podiumData}
      />
    </main>
  );
}
