import { redirect } from 'next/navigation';

import { loadGroupMatches } from '@/app/(porra)/porra/load-group-matches';
import { loadKnockoutMatches } from '@/app/(porra)/porra/load-knockout';
import { loadUserPredictions } from '@/app/(porra)/porra/load-predictions';
import { PorraReadonly } from '@/components/porra/porra-readonly';
import { getCurrentUser } from '@/lib/auth/current-user';
import { loadTeamsMap } from '@/lib/db/teams-map';

// Vista de SOLO LECTURA de la porra propia. La porra de uno mismo siempre es
// visible para su dueño (no se filtra por bloqueo, a diferencia de §8 para otros).
// Para editar se usa /porra; aquí solo se consulta.
export default async function MiPorraPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [predictions, groupMatches, knockout, teams] = await Promise.all([
    loadUserPredictions(user.id),
    loadGroupMatches(),
    loadKnockoutMatches(),
    loadTeamsMap(),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <p className="text-eyebrow mb-1">Tu álbum</p>
        <h1 className="text-display-l">Mi porra</h1>
        <p className="text-sm text-ink-muted">
          Solo lectura. Para colocar o cambiar cromos, ve a{' '}
          <a href="/porra" className="text-cromo-cobalt underline">
            rellenar tu porra
          </a>
          .
        </p>
      </div>
      <PorraReadonly
        predictions={predictions}
        groupMatches={groupMatches}
        knockout={knockout}
        teams={teams}
      />
    </main>
  );
}
