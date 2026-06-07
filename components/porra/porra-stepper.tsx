'use client';

import { useState } from 'react';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import type { GroupTeamsCatalog } from '@/app/(porra)/porra/load-group-teams';
import { BestThirdsTab } from '@/components/porra/best-thirds-tab';
import { GruposTab } from '@/components/porra/grupos-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BEST_THIRDS_COUNT,
  GROUP_LETTERS,
  MATCHES_GROUP_STAGE,
  PORRA_TABS,
} from '@/lib/constants';
import type { UserPredictions } from '@/lib/predictions/types';
import type { PredictionLocks } from '@/lib/scoring/locks';

type Completion = 'complete' | 'partial' | 'empty';

type PorraStepperProps = {
  initialData: UserPredictions;
  locks: PredictionLocks;
  groupMatchesCatalog: GroupCatalog[];
  groupTeamsCatalog: GroupTeamsCatalog[];
};

const completionColor: Record<Completion, string> = {
  complete: 'bg-green-500',
  partial: 'bg-amber-400',
  empty: 'bg-zinc-300',
};

const completionLabel: Record<Completion, string> = {
  complete: 'completo',
  partial: 'incompleto',
  empty: 'sin rellenar',
};

// Chasis del formulario de porra (slice 4). El tab "Grupos" ya tiene contenido
// real (sub-slice 4.2); el resto sigue como placeholder hasta 4.3+.
export function PorraStepper({
  initialData,
  locks,
  groupMatchesCatalog,
  groupTeamsCatalog,
}: PorraStepperProps) {
  const [active, setActive] = useState<string>(PORRA_TABS[0].id);

  // MVP (scoring-rules.md §5): bloqueo global, todas las categorías comparten
  // estado. Basta con que alguna esté bloqueada para mostrar el banner.
  const locked = Object.values(locks).some(Boolean);

  function completionOf(tabId: string): Completion {
    if (tabId === 'grupos') {
      // El tab Grupos cubre dos categorías: marcadores (72 partidos) y orden de
      // los 12 grupos. Solo está completo si ambas lo están.
      const matchesFilled = initialData.groupMatches.length;
      const groupsOrdered = new Set(
        initialData.groupStandings.map((s) => s.groupLetter),
      ).size;
      const matchesComplete = matchesFilled >= MATCHES_GROUP_STAGE;
      const standingsComplete = groupsOrdered >= GROUP_LETTERS.length;
      if (matchesComplete && standingsComplete) {
        return 'complete';
      }
      return matchesFilled > 0 || groupsOrdered > 0 ? 'partial' : 'empty';
    }
    if (tabId === 'mejores-terceros') {
      const picked = initialData.bestThirds.length;
      if (picked >= BEST_THIRDS_COUNT) {
        return 'complete';
      }
      return picked > 0 ? 'partial' : 'empty';
    }
    return 'empty';
  }

  return (
    <div data-testid="porra-stepper" className="flex w-full max-w-3xl flex-col gap-4">
      {locked ? (
        <p
          role="status"
          data-testid="porra-banner"
          className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800"
        >
          BLOQUEADA — las predicciones ya no se pueden modificar.
        </p>
      ) : (
        <p
          role="status"
          data-testid="porra-banner"
          className="rounded border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700"
        >
          PORRA INCOMPLETA — rellena todas las categorías antes del cierre.
        </p>
      )}

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex h-auto flex-wrap">
          {PORRA_TABS.map((tab) => {
            const completion = completionOf(tab.id);
            return (
              <TabsTrigger key={tab.id} value={tab.id} data-testid={`porra-tab-${tab.id}`}>
                <span
                  data-testid={`porra-tab-mark-${tab.id}`}
                  aria-label={completionLabel[completion]}
                  title={completionLabel[completion]}
                  className={`mr-1.5 inline-block size-2 rounded-full ${completionColor[completion]}`}
                />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PORRA_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.id === 'grupos' ? (
              <section data-testid={`porra-panel-${tab.id}`} className="p-2">
                <GruposTab
                  matchesCatalog={groupMatchesCatalog}
                  teamsCatalog={groupTeamsCatalog}
                  initialMatches={initialData.groupMatches}
                  initialStandings={initialData.groupStandings}
                  matchesLocked={locks.groupMatches}
                  standingsLocked={locks.groupStandings}
                />
              </section>
            ) : tab.id === 'mejores-terceros' ? (
              <section data-testid={`porra-panel-${tab.id}`} className="p-2">
                <BestThirdsTab
                  teamsCatalog={groupTeamsCatalog}
                  standings={initialData.groupStandings}
                  initial={initialData.bestThirds}
                  locked={locks.bestThirds}
                  onGoToGroups={() => setActive('grupos')}
                />
              </section>
            ) : (
              <section
                data-testid={`porra-panel-${tab.id}`}
                className="rounded border border-zinc-200 p-6"
              >
                <h2 className="text-lg font-semibold">{tab.label}</h2>
                <p className="mt-2 text-zinc-500">Próximamente (sub-slice 4.5+).</p>
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
