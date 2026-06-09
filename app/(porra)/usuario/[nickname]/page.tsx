import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';

import { loadGroupMatches } from '@/app/(porra)/porra/load-group-matches';
import { loadKnockoutMatches } from '@/app/(porra)/porra/load-knockout';
import {
  PorraReadonly,
  type PorraReadonlySection,
} from '@/components/porra/porra-readonly';
import { getCurrentUser } from '@/lib/auth/current-user';
import { db, users } from '@/lib/db';
import { loadTeamsMap } from '@/lib/db/teams-map';
import { loadVisiblePredictions } from '@/lib/predictions/visibility';
import { loadAllLocks } from '@/lib/scoring/locks';

// Porra de OTRO usuario. Solo predicciones ya bloqueadas (scoring-rules.md §8):
// el filtrado ocurre en servidor (loadVisiblePredictions); el cliente jamás
// recibe una predicción abierta de otro jugador.

// Resuelve nickname → usuario, case-insensitive (data-model.md §2.1). Devuelve
// solo lo necesario para la vista; nunca hash ni email.
async function findUserByNickname(nickname: string) {
  const [row] = await db
    .select({ id: users.id, nickname: users.nickname })
    .from(users)
    .where(sql`lower(${users.nickname}) = lower(${nickname})`)
    .limit(1);
  return row ?? null;
}

export default async function UsuarioPage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    redirect('/login');
  }

  const { nickname } = await params;
  const target = await findUserByNickname(nickname);
  if (!target) {
    notFound();
  }

  const now = new Date();
  const [predictions, groupMatches, knockout, teams] = await Promise.all([
    loadVisiblePredictions(target.id, now),
    loadGroupMatches(),
    loadKnockoutMatches(),
    loadTeamsMap(),
  ]);

  // Qué secciones siguen ocultas por bloqueo, para marcarlas con candado en vez
  // de "sin predicciones" (se deriva del mismo estado de lock que filtra los datos).
  const locks = loadAllLocks(now);
  const hiddenSections = new Set<PorraReadonlySection>();
  if (!locks.groupMatches) hiddenSections.add('groupMatches');
  if (!locks.groupStandings) hiddenSections.add('groupStandings');
  if (!locks.bestThirds) hiddenSections.add('bestThirds');
  if (!locks.knockout) hiddenSections.add('knockout');
  if (!locks.awards) hiddenSections.add('awards');

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">Porra de {target.nickname}</h1>
        <p className="text-sm text-muted-foreground">
          Solo se muestran las predicciones ya bloqueadas.
        </p>
      </div>
      <PorraReadonly
        predictions={predictions}
        groupMatches={groupMatches}
        knockout={knockout}
        teams={teams}
        hiddenSections={hiddenSections}
      />
    </main>
  );
}
