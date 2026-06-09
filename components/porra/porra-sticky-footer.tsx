'use client';

import { useState } from 'react';

import { PorraReviewPanel } from '@/components/porra/porra-review-panel';
import type { Mismatch, PorraSummary } from '@/lib/scoring/porra-summary';

// Barra inferior fija con el estado global de la porra (sub-slice 4.8). Siempre
// visible en /porra; al pulsarla abre el panel de revisión. El color y el texto
// se derivan del summary: verde (completa), ámbar (solo huecos), naranja (hay
// inconsistencias, con o sin huecos).

type PorraStickyFooterProps = {
  summary: PorraSummary;
  onGoToTab: (tabId: string) => void;
  onGoToMismatch: (m: Mismatch) => void;
  onSync: (m: Mismatch) => void;
};

type FooterStyle = {
  testidState: string;
  className: string;
  text: string;
};

// Voz de álbum (design-system §7): "te faltan N cromos" / "¡álbum completo!" /
// "revisar". El color sigue el estado (mint completo, coral huecos, ámbar revisar)
// y los data-state se conservan para el contrato de los e2e.
function footerStyle(summary: PorraSummary): FooterStyle {
  const { totalGaps, totalMismatches } = summary;

  const cromos = (n: number) => `${n} ${n === 1 ? 'cromo' : 'cromos'}`;
  const porRevisar = (n: number) => `${n} por revisar`;

  if (totalGaps === 0 && totalMismatches === 0) {
    return {
      testidState: 'completa',
      className: 'border-cromo-mint/40 bg-cromo-mint/10 text-cromo-mint',
      text: '¡Álbum completo!',
    };
  }

  if (totalGaps > 0 && totalMismatches > 0) {
    return {
      testidState: 'mixta',
      className: 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300',
      text: `Te faltan ${cromos(totalGaps)} · ${porRevisar(totalMismatches)}`,
    };
  }

  if (totalMismatches > 0) {
    return {
      testidState: 'revisar',
      className: 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300',
      text: `Revisar — ${porRevisar(totalMismatches)}`,
    };
  }

  return {
    testidState: 'incompleta',
    className: 'border-cromo-coral/40 bg-cromo-coral/10 text-cromo-coral',
    text: `Te faltan ${cromos(totalGaps)}`,
  };
}

export function PorraStickyFooter({
  summary,
  onGoToTab,
  onGoToMismatch,
  onSync,
}: PorraStickyFooterProps) {
  const [open, setOpen] = useState(false);
  const style = footerStyle(summary);

  return (
    <>
      <button
        type="button"
        data-testid="porra-sticky-footer"
        data-state={style.testidState}
        onClick={() => setOpen(true)}
        className={`fixed inset-x-0 bottom-0 z-40 flex min-h-[44px] w-full items-center justify-center border-t px-4 py-2 text-sm font-semibold ${style.className}`}
      >
        {style.text}
      </button>

      <PorraReviewPanel
        open={open}
        onOpenChange={setOpen}
        summary={summary}
        onGoToTab={(tabId) => {
          setOpen(false);
          onGoToTab(tabId);
        }}
        onGoToMismatch={(m) => {
          setOpen(false);
          onGoToMismatch(m);
        }}
        onSync={onSync}
      />
    </>
  );
}
