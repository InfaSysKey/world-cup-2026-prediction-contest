'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  Mismatch,
  MismatchTab,
  PorraSummary,
} from '@/lib/scoring/porra-summary';

// Panel lateral de revisión (sub-slice 4.8). Se abre desde el sticky footer y
// lista, en dos secciones colapsables, los huecos (predicciones sin rellenar) y
// las inconsistencias (validaciones cruzadas). Cada entrada navega al tab
// correspondiente; las de podio desincronizado ofrecen además "Sincronizar".
//
// Si la porra está completa y coherente, muestra solo un mensaje de enhorabuena.

type TabMeta = {
  key: MismatchTab;
  label: string;
  // Tab del stepper al que saltar para rellenar huecos de esta categoría.
  tabId: string;
};

const TABS_META: TabMeta[] = [
  { key: 'grupos', label: 'Grupos', tabId: 'grupos' },
  { key: 'terceros', label: 'Mejores Terceros', tabId: 'mejores-terceros' },
  { key: 'bracket', label: 'Bracket', tabId: 'dieciseisavos' },
  { key: 'podio', label: 'Podio', tabId: 'podio' },
  { key: 'premios', label: 'Premios', tabId: 'premios' },
];

const TAB_LABEL: Record<MismatchTab, string> = {
  grupos: 'Grupos',
  terceros: 'Mejores Terceros',
  bracket: 'Bracket',
  podio: 'Podio',
  premios: 'Premios',
};

type PorraReviewPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: PorraSummary;
  onGoToTab: (tabId: string) => void;
  onGoToMismatch: (m: Mismatch) => void;
  onSync: (m: Mismatch) => void;
};

export function PorraReviewPanel({
  open,
  onOpenChange,
  summary,
  onGoToTab,
  onGoToMismatch,
  onSync,
}: PorraReviewPanelProps) {
  const complete = summary.overallStatus === 'completa';
  const gapTabs = TABS_META.filter((t) => summary.tabs[t.key].gaps > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" data-testid="porra-review-panel">
        <SheetHeader>
          <SheetTitle>Revisión de tu porra</SheetTitle>
          <SheetDescription>
            Huecos por rellenar e inconsistencias entre tus predicciones.
          </SheetDescription>
        </SheetHeader>

        {complete ? (
          <div
            data-testid="porra-review-complete"
            className="px-4 text-sm text-green-700"
          >
            <p className="font-semibold">¡Porra lista! 🎉</p>
            <p className="mt-1 text-zinc-600">
              Cuando empiece el Mundial el 11 de junio se bloqueará
              automáticamente.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
            <details data-testid="porra-review-gaps" open className="group">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                Huecos ({summary.totalGaps})
              </summary>
              {gapTabs.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No te queda ningún hueco por rellenar.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {gapTabs.map((t) => (
                    <li
                      key={t.key}
                      data-testid={`porra-review-gap-${t.key}`}
                      className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 text-xs"
                    >
                      <span>
                        <span className="font-medium">[{t.label}]</span> Faltan{' '}
                        {summary.tabs[t.key].gaps}{' '}
                        {summary.tabs[t.key].gaps === 1
                          ? 'predicción'
                          : 'predicciones'}
                      </span>
                      <button
                        type="button"
                        data-testid={`porra-review-gap-goto-${t.key}`}
                        onClick={() => onGoToTab(t.tabId)}
                        className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 font-medium hover:bg-zinc-100"
                      >
                        Ir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details data-testid="porra-review-mismatches" open className="group">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
                Inconsistencias ({summary.totalMismatches})
              </summary>
              {summary.mismatches.length === 0 ? (
                <p
                  data-testid="porra-review-mismatches-empty"
                  className="mt-2 text-xs text-green-700"
                >
                  Sin inconsistencias entre tus predicciones. 👌
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {summary.mismatches.map((m) => (
                    <li
                      key={m.id}
                      data-testid={`porra-review-mismatch-${m.id}`}
                      className={`flex flex-col gap-1 rounded border px-2 py-1.5 text-xs ${
                        m.severity === 'error'
                          ? 'border-red-300 bg-red-50 text-red-800'
                          : 'border-amber-300 bg-amber-50 text-amber-800'
                      }`}
                    >
                      <span>
                        <span aria-hidden>
                          {m.severity === 'error' ? '⛔' : '⚠'}
                        </span>{' '}
                        <span className="font-medium">[{TAB_LABEL[m.tab]}]</span>{' '}
                        {m.message}
                      </span>
                      <span className="flex gap-2">
                        {m.fix?.action === 'sync-to-bracket' ? (
                          <button
                            type="button"
                            data-testid={`porra-review-sync-${m.id}`}
                            onClick={() => onSync(m)}
                            className="rounded border border-current px-2 py-0.5 font-medium"
                          >
                            {m.fix.label}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          data-testid={`porra-review-goto-${m.id}`}
                          onClick={() => onGoToMismatch(m)}
                          className="rounded border border-current px-2 py-0.5 font-medium"
                        >
                          Ir al tab
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
