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

function footerStyle(summary: PorraSummary): FooterStyle {
  const { totalGaps, totalMismatches } = summary;

  if (totalGaps === 0 && totalMismatches === 0) {
    return {
      testidState: 'completa',
      className: 'border-green-300 bg-green-50 text-green-800',
      text: 'PORRA COMPLETA ✓',
    };
  }

  if (totalGaps > 0 && totalMismatches > 0) {
    return {
      testidState: 'mixta',
      className: 'border-orange-300 bg-orange-50 text-orange-800',
      text: `INCOMPLETA + REVISAR — ${totalGaps} ${
        totalGaps === 1 ? 'hueco' : 'huecos'
      }, ${totalMismatches} ${
        totalMismatches === 1 ? 'inconsistencia' : 'inconsistencias'
      }`,
    };
  }

  if (totalMismatches > 0) {
    return {
      testidState: 'revisar',
      className: 'border-orange-300 bg-orange-50 text-orange-800',
      text: `REVISAR — ${totalMismatches} ${
        totalMismatches === 1 ? 'inconsistencia' : 'inconsistencias'
      }`,
    };
  }

  return {
    testidState: 'incompleta',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
    text: `INCOMPLETA — faltan ${totalGaps} ${
      totalGaps === 1 ? 'predicción' : 'predicciones'
    }`,
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
