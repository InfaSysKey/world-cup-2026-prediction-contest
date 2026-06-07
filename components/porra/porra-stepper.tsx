'use client';

import { useState } from 'react';

import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import { GroupMatchesTab } from '@/components/porra/group-matches-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MATCHES_GROUP_STAGE, PORRA_TABS } from '@/lib/constants';
import type { UserPredictions } from '@/lib/predictions/types';
import type { PredictionLocks } from '@/lib/scoring/locks';

type Completion = 'complete' | 'partial' | 'empty';

type PorraStepperProps = {
  initialData: UserPredictions;
  locks: PredictionLocks;
  groupMatchesCatalog: GroupCatalog[];
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
}: PorraStepperProps) {
  const [active, setActive] = useState<string>(PORRA_TABS[0].id);

  // MVP (scoring-rules.md §5): bloqueo global, todas las categorías comparten
  // estado. Basta con que alguna esté bloqueada para mostrar el banner.
  const locked = Object.values(locks).some(Boolean);

  function completionOf(tabId: string): Completion {
    if (tabId === 'grupos') {
      const filled = initialData.groupMatches.length;
      if (filled >= MATCHES_GROUP_STAGE) {
        return 'complete';
      }
      return filled > 0 ? 'partial' : 'empty';
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
                <GroupMatchesTab
                  catalog={groupMatchesCatalog}
                  initial={initialData.groupMatches}
                  locked={locks.groupMatches}
                />
              </section>
            ) : (
              <section
                data-testid={`porra-panel-${tab.id}`}
                className="rounded border border-zinc-200 p-6"
              >
                <h2 className="text-lg font-semibold">{tab.label}</h2>
                <p className="mt-2 text-zinc-500">Próximamente (sub-slice 4.3+).</p>
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
