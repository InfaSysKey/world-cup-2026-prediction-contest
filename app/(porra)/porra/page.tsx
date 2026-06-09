import { redirect } from 'next/navigation';

import { PorraStepper } from '@/components/porra/porra-stepper';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadAllLocks } from '@/lib/scoring/locks';

import { loadGroupMatches } from './load-group-matches';
import { loadGroupTeams } from './load-group-teams';
import { loadKnockoutMatches } from './load-knockout';
import { derivePodium } from './load-podium';
import { loadUserPredictions } from './load-predictions';

export default async function PorraPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [initialData, groupMatchesCatalog, groupTeamsCatalog, knockoutCatalog] =
    await Promise.all([
      loadUserPredictions(user.id),
      loadGroupMatches(),
      loadGroupTeams(),
      loadKnockoutMatches(),
    ]);
  // El podio se deriva de lo ya cargado (predicciones + catálogo de cruces): no
  // necesita consultas propias (ADR 0005, MINOR 7 del informe ultracode).
  const podiumData = derivePodium(
    initialData.awards,
    initialData.knockout,
    knockoutCatalog,
  );
  const locks = loadAllLocks();

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8">
      <header className="flex w-full max-w-3xl items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hola, {user.nickname}</h1>
      </header>

      <PorraStepper
        initialData={initialData}
        locks={locks}
        groupMatchesCatalog={groupMatchesCatalog}
        groupTeamsCatalog={groupTeamsCatalog}
        knockoutCatalog={knockoutCatalog}
        podium={podiumData}
      />
    </main>
  );
}
