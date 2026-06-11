'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  saveKnockoutPredictions,
  savePodiumPrediction,
} from '@/app/(porra)/porra/actions';
import type { GroupCatalog } from '@/app/(porra)/porra/load-group-matches';
import type { GroupTeamsCatalog } from '@/app/(porra)/porra/load-group-teams';
import type { PodiumData } from '@/app/(porra)/porra/load-podium';
import { premiosStateFromAwards } from '@/app/(porra)/porra/premios-completion';
import { AlbumProgress } from '@/components/porra/album-progress';
import { BestThirdsTab } from '@/components/porra/best-thirds-tab';
import { BracketPhase } from '@/components/porra/bracket-phase';
import { GruposTab } from '@/components/porra/grupos-tab';
import { PodioTab } from '@/components/porra/podio-tab';
import { PorraStickyFooter } from '@/components/porra/porra-sticky-footer';
import { PremiosTab } from '@/components/porra/premios-tab';
import { TeamLabel } from '@/components/porra/team-label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BEST_THIRDS_COUNT,
  BRACKET_TAB_PHASE,
  MATCHES_GROUP_STAGE,
  MATCHES_KNOCKOUT,
  PORRA_TABS,
  type BracketTabId,
} from '@/lib/constants';
import type { Phase } from '@/lib/db';
import { useAutoSave } from '@/lib/hooks/use-auto-save';
import type { UserPredictions } from '@/lib/predictions/types';
import { deducePodium } from '@/lib/scoring/deduce-podium';
import type { PredictionLocks } from '@/lib/scoring/locks';
import {
  computePorraSummary,
  type Mismatch,
  type MismatchTab,
} from '@/lib/scoring/porra-summary';
import {
  resolveBracket,
  type KnockoutMatchRef,
  type KnockoutPickRef,
} from '@/lib/scoring/resolve-bracket';

type Completion = 'complete' | 'revisar' | 'partial' | 'empty';

function isBracketTab(tabId: string): tabId is BracketTabId {
  return tabId in BRACKET_TAB_PHASE;
}

// Qué tab del stepper corresponde a cada categoría del summary (para navegar
// desde el panel de revisión). El bracket entra por su primera ronda.
const SUMMARY_TAB_TO_STEPPER: Record<MismatchTab, string> = {
  grupos: 'grupos',
  terceros: 'mejores-terceros',
  bracket: 'dieciseisavos',
  podio: 'podio',
  premios: 'premios',
};

// Inverso de BRACKET_TAB_PHASE (fase → id del tab del bracket). Literal explícito
// para no castear; mantener en sync con BRACKET_TAB_PHASE.
const PHASE_TO_BRACKET_TAB: Record<Phase, BracketTabId | undefined> = {
  '1/16': 'dieciseisavos',
  '1/8': 'octavos',
  cuartos: 'cuartos',
  semi: 'semis',
  '3-4': 'tercer-puesto',
  final: 'final',
  grupos: undefined,
};

type PorraStepperProps = {
  initialData: UserPredictions;
  locks: PredictionLocks;
  groupMatchesCatalog: GroupCatalog[];
  groupTeamsCatalog: GroupTeamsCatalog[];
  knockoutCatalog: KnockoutMatchRef[];
  podium: PodiumData;
};

const completionColor: Record<Completion, string> = {
  complete: 'bg-cromo-mint',
  revisar: 'bg-amber-500',
  partial: 'bg-cromo-coral',
  empty: 'bg-slot',
};

const completionLabel: Record<Completion, string> = {
  complete: 'completo',
  revisar: 'revisar',
  partial: 'incompleto',
  empty: 'sin rellenar',
};

// Total de cromos del álbum: suma de los slots de cada categoría (mismos máximos
// que usa computePorraSummary para los gaps): 72 marcadores + 48 órdenes de grupo
// (12×4) + 8 terceros + 32 cruces + 3 podio + 6 premios.
const ALBUM_TOTAL_SLOTS =
  MATCHES_GROUP_STAGE + 48 + BEST_THIRDS_COUNT + MATCHES_KNOCKOUT + 3 + 6;

// Chasis del formulario de porra (slice 4). El tab "Grupos" ya tiene contenido
// real (sub-slice 4.2); el resto sigue como placeholder hasta 4.3+.
export function PorraStepper({
  initialData,
  locks,
  groupMatchesCatalog,
  groupTeamsCatalog,
  knockoutCatalog,
  podium,
}: PorraStepperProps) {
  const [active, setActive] = useState<string>(PORRA_TABS[0].id);

  // MVP (scoring-rules.md §5): bloqueo global, todas las categorías comparten
  // estado. Basta con que alguna esté bloqueada para mostrar el banner.
  const locked = Object.values(locks).some(Boolean);

  // --- Estado y resolución del bracket eliminatorio (sub-slice 4.5) ---

  // Catálogo de equipos plano: code → {flagCode, name} para etiquetar los cruces,
  // y code → grupo para resolver los slots de mejor 3.º.
  const { teamLabel, teamGroup, teamName } = useMemo(() => {
    const label = new Map<string, { flagCode: string; name: string }>();
    const group = new Map<string, string>();
    const nameMap = new Map<string, string>();
    for (const g of groupTeamsCatalog) {
      for (const t of g.teams) {
        label.set(t.code, { flagCode: t.flagCode, name: t.name });
        group.set(t.code, g.groupLetter);
        nameMap.set(t.code, t.name);
      }
    }
    return { teamLabel: label, teamGroup: group, teamName: nameMap };
  }, [groupTeamsCatalog]);

  // Las predicciones de bracket son el único estado reactivo del árbol: standings
  // y mejores terceros se toman del snapshot del servidor (igual que el tab de
  // mejores terceros). Al pulsar un ganador, las rondas siguientes se re-resuelven
  // en cliente sin recargar.
  const [knockout, setKnockout] = useState<KnockoutPickRef[]>(() =>
    initialData.knockout.map((k) => ({
      matchId: k.matchId,
      winnerTeamCode: k.winnerTeamCode,
    })),
  );
  // Snapshot vivo de los picks: onPick acumula sobre el ref para que pulsaciones
  // muy seguidas no dependan del re-render entre clics. El autosave guarda el
  // snapshot COMPLETO, nunca un delta suelto (CRÍTICO 1).
  const knockoutRef = useRef(knockout);
  useEffect(() => {
    knockoutRef.current = knockout;
  }, [knockout]);

  const resolution = useMemo(
    () =>
      resolveBracket({
        matches: knockoutCatalog,
        standings: initialData.groupStandings,
        bestThirds: initialData.bestThirds,
        knockout,
        teamGroup,
      }),
    [
      knockoutCatalog,
      initialData.groupStandings,
      initialData.bestThirds,
      knockout,
      teamGroup,
    ],
  );

  const onSaveKnockout = useCallback(async (picks: KnockoutPickRef[]) => {
    const res = await saveKnockoutPredictions(picks);
    if (res.error) {
      throw new Error(res.error.message);
    }
  }, []);

  const {
    status: knockoutStatus,
    save: saveKnockout,
    retry: retryKnockout,
  } = useAutoSave<KnockoutPickRef[]>(onSaveKnockout);

  const onPick = useCallback(
    (matchId: number, winnerTeamCode: string) => {
      if (locked) {
        return;
      }
      // Acumula sobre el snapshot vivo y manda el set COMPLETO al autosave: por
      // mucho que se coalescan pulsaciones rápidas, no se pierde ningún pick.
      const next = [
        ...knockoutRef.current.filter((p) => p.matchId !== matchId),
        { matchId, winnerTeamCode },
      ];
      knockoutRef.current = next;
      setKnockout(next);
      saveKnockout(next);
    },
    [locked, saveKnockout],
  );

  const knockoutLabel = useCallback(
    (code: string): React.ReactNode => {
      const t = teamLabel.get(code);
      return t ? <TeamLabel flagCode={t.flagCode} name={t.name} /> : code;
    },
    [teamLabel],
  );

  const phaseByMatch = useMemo(
    () => new Map(knockoutCatalog.map((m) => [m.id, m.phase])),
    [knockoutCatalog],
  );

  // --- Resumen global (sub-slice 4.8): única fuente de verdad del estado ---
  // Standings, terceros, podio y premios salen del snapshot del servidor (que se
  // refresca tras cada autosave vía revalidatePath); el bracket usa el estado
  // reactivo de los picks para que el footer responda al instante.
  const summary = useMemo(
    () =>
      computePorraSummary(
        {
          groupMatches: initialData.groupMatches,
          groupStandings: initialData.groupStandings,
          bestThirds: initialData.bestThirds,
          knockout,
          awards: initialData.awards,
        },
        { knockoutMatches: knockoutCatalog, teamGroup, teamName },
      ),
    [initialData, knockout, knockoutCatalog, teamGroup, teamName],
  );

  const router = useRouter();

  // Al cambiar de tab de forma PROGRAMÁTICA (footer, huecos, mismatch) Radix no
  // mueve el foco como sí hace al pulsar un trigger; lo llevamos nosotros al panel
  // activo (role="tabpanel", tabindex 0) para que teclado y lector de pantalla no
  // se queden anclados en el footer. Se difiere porque Radix monta el panel al
  // activarlo.
  const focusActivePanel = useCallback(() => {
    setTimeout(() => {
      document
        .querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]')
        ?.focus();
    }, 60);
  }, []);

  // Navega al tab indicado (huecos) o al tab + ancla de un mismatch, haciendo
  // scroll al elemento. Radix monta el contenido del tab al activarlo, así que
  // el scroll se difiere a la siguiente vuelta del event loop.
  const goToTab = useCallback(
    (tabId: string) => {
      setActive(tabId);
      focusActivePanel();
    },
    [focusActivePanel],
  );

  const goToMismatch = useCallback(
    (m: Mismatch) => {
      let tabId = SUMMARY_TAB_TO_STEPPER[m.tab];
      if (m.tab === 'bracket') {
        const matched = /^bracket-match-(\d+)$/.exec(m.anchor);
        const phase = matched ? phaseByMatch.get(Number(matched[1])) : undefined;
        if (phase && PHASE_TO_BRACKET_TAB[phase]) {
          tabId = PHASE_TO_BRACKET_TAB[phase];
        }
      }
      setActive(tabId);
      focusActivePanel();
      setTimeout(() => {
        document
          .querySelector(`[data-testid="${m.anchor}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    },
    [phaseByMatch, focusActivePanel],
  );

  // Sincroniza un puesto del podio con la deducción del bracket desde el panel.
  // Reescribe la fila vía la Server Action y refresca para que el snapshot (y el
  // summary) reflejen el cambio.
  const syncPodiumToBracket = useCallback(
    (m: Mismatch) => {
      const slot = /^podio\.(champion|runnerUp|third)\./.exec(m.id)?.[1];
      if (slot !== 'champion' && slot !== 'runnerUp' && slot !== 'third') {
        return;
      }
      const picks = knockout.flatMap((k) => {
        const phase = phaseByMatch.get(k.matchId);
        return phase ? [{ phase, winnerTeamCode: k.winnerTeamCode }] : [];
      });
      const expected = deducePodium(picks)[slot];
      if (!expected) {
        return;
      }
      const byKind = new Map(
        initialData.awards.map((a) => [a.kind, a.teamCode]),
      );
      const current = {
        champion: byKind.get('champion') ?? null,
        runnerUp: byKind.get('runner_up') ?? null,
        third: byKind.get('third') ?? null,
      };
      void savePodiumPrediction({ ...current, [slot]: expected }).then(() =>
        router.refresh(),
      );
    },
    [knockout, phaseByMatch, initialData.awards, router],
  );

  // El indicador de cada tab sale del summary (única fuente de verdad, sub-slice
  // 4.8). Los 6 tabs del bracket comparten el estado agregado de la categoría
  // bracket. La distinción visual vacío/parcial es lo único que decide el
  // stepper, porque el summary solo expone completa/incompleta/revisar.
  function summaryKeyOf(tabId: string): MismatchTab | null {
    if (tabId === 'grupos') return 'grupos';
    if (tabId === 'mejores-terceros') return 'terceros';
    if (tabId === 'podio') return 'podio';
    if (tabId === 'premios') return 'premios';
    if (isBracketTab(tabId)) return 'bracket';
    return null;
  }

  function tabHasData(key: MismatchTab): boolean {
    switch (key) {
      case 'grupos':
        return (
          initialData.groupMatches.length > 0 ||
          initialData.groupStandings.length > 0
        );
      case 'terceros':
        return initialData.bestThirds.length > 0;
      case 'bracket':
        return knockout.length > 0;
      case 'podio':
        return initialData.awards.some(
          (a) =>
            (a.kind === 'champion' ||
              a.kind === 'runner_up' ||
              a.kind === 'third') &&
            a.teamCode !== null,
        );
      case 'premios':
        return initialData.awards.some(
          (a) => a.kind.startsWith('boot_') || a.kind.startsWith('ball_'),
        );
    }
  }

  function completionOf(tabId: string): Completion {
    const key = summaryKeyOf(tabId);
    if (!key) {
      return 'empty';
    }
    const status = summary.tabs[key].status;
    if (status === 'completa') {
      return 'complete';
    }
    if (status === 'revisar') {
      return 'revisar';
    }
    return tabHasData(key) ? 'partial' : 'empty';
  }

  const albumFilled = ALBUM_TOTAL_SLOTS - summary.totalGaps;

  return (
    <div data-testid="porra-stepper" className="flex w-full max-w-3xl flex-col gap-4">
      {locked ? (
        <p
          role="status"
          data-testid="porra-banner"
          className="rounded-[14px] border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
        >
          BLOQUEADA — las predicciones ya no se pueden modificar.
        </p>
      ) : (
        <p
          role="status"
          data-testid="porra-banner"
          className="rounded-[14px] border border-slot bg-surface px-4 py-2 text-sm font-medium text-ink-muted"
        >
          PORRA INCOMPLETA — completa todas las categorías antes del cierre.
        </p>
      )}

      {!locked ? (
        <AlbumProgress filled={albumFilled} total={ALBUM_TOTAL_SLOTS} />
      ) : null}

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
            ) : tab.id === 'podio' ? (
              <section data-testid={`porra-panel-${tab.id}`} className="p-2">
                <PodioTab
                  teamsCatalog={groupTeamsCatalog}
                  persisted={podium.persisted}
                  suggested={podium.suggested}
                  locked={locks.awards}
                />
              </section>
            ) : tab.id === 'premios' ? (
              <section data-testid={`porra-panel-${tab.id}`} className="p-2">
                <PremiosTab
                  initial={premiosStateFromAwards(initialData.awards)}
                  locked={locks.awards}
                />
              </section>
            ) : isBracketTab(tab.id) ? (
              <section data-testid={`porra-panel-${tab.id}`} className="p-2">
                <BracketPhase
                  tabId={tab.id}
                  matches={knockoutCatalog
                    .filter((m) => m.phase === BRACKET_TAB_PHASE[tab.id])
                    .map((m) => resolution.get(m.id))
                    .filter((m): m is NonNullable<typeof m> => m !== undefined)}
                  teamLabel={knockoutLabel}
                  locked={locks.knockout}
                  status={knockoutStatus}
                  onRetry={retryKnockout}
                  onPick={onPick}
                />
              </section>
            ) : (
              <section
                data-testid={`porra-panel-${tab.id}`}
                className="rounded-[14px] border border-slot p-6"
              >
                <h2 className="text-lg font-semibold text-ink">{tab.label}</h2>
                <p className="mt-2 text-ink-muted">Próximamente.</p>
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Espaciador para que el footer fijo no tape el contenido. */}
      <div className="h-12" aria-hidden />

      <PorraStickyFooter
        summary={summary}
        onGoToTab={goToTab}
        onGoToMismatch={goToMismatch}
        onSync={syncPodiumToBracket}
      />
    </div>
  );
}
