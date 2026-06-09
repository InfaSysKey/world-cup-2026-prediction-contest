// Barra de progreso "% del álbum" (design-system §3, §5). Relleno en mint; el
// copy usa la voz de álbum (§7): "te faltan N cromos" / "¡álbum completo!".

type Props = {
  filled: number;
  total: number;
};

export function AlbumProgress({ filled, total }: Props) {
  const safeTotal = Math.max(1, total);
  const clamped = Math.min(Math.max(filled, 0), safeTotal);
  const pct = Math.round((clamped / safeTotal) * 100);
  const missing = safeTotal - clamped;

  return (
    <div data-testid="album-progress" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-eyebrow">{pct}% del álbum</span>
        <span className="text-sm text-ink-muted">
          {missing === 0
            ? '¡álbum completo!'
            : `te faltan ${missing} ${missing === 1 ? 'cromo' : 'cromos'}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del álbum"
        className="h-2.5 w-full overflow-hidden rounded-full bg-slot"
      >
        <div
          className="h-full rounded-full bg-cromo-mint transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
