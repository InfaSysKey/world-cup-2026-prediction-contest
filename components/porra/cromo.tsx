import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Cromo: la unidad visual del álbum (design-system §4, §5). Reemplaza el uso
// genérico de Card en las pantallas de dominio.
//   - normal: carta colocada, con material real (gloss + gleam + sombra en capas).
//   - slot: hueco editable aún sin rellenar (borde discontinuo, sin material),
//           pero con los hijos en flujo (p. ej. el duelo con sus inputs "?").
//   - empty: hueco sin contenido (borde discontinuo + "?" centrado).
// El shiny holográfico (el #1) es <FoilCromo>, no una variante de aquí.
//
// El material vive en .cromo-card (globals.css). Aquí solo se componen clases y
// se colocan los adornos como spans absolutos: al estar fuera de flujo no
// estorban a layouts flex/grid de los hijos.

const cromoVariants = cva("relative", {
  variants: {
    variant: {
      normal: "cromo-card text-ink",
      slot: "rounded-[18px] border-[1.5px] border-dashed border-slot bg-bg px-4 pt-[18px] pb-4 text-ink",
      empty:
        "flex min-h-16 items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-slot bg-bg p-4 text-ink-muted",
    },
  },
  defaultVariants: {
    variant: "normal",
  },
});

type CromoProps = React.ComponentProps<"div"> &
  VariantProps<typeof cromoVariants> & {
    // Pestañita con el número de cromo (p. ej. "CROMO 01"), esquina sup. izq.
    number?: string;
    // Badge de estado (p. ej. "✓ colocado"), esquina sup. der. Solo normal/foil.
    status?: React.ReactNode;
  };

function Cromo({
  className,
  variant = "normal",
  number,
  status,
  children,
  ...props
}: CromoProps) {
  const hasMaterial = variant === "normal";
  const isEmpty = variant === "empty";

  return (
    <div
      data-slot="cromo"
      data-variant={variant}
      className={cn(cromoVariants({ variant }), className)}
      {...props}
    >
      {number != null ? (
        <span className="cromo-num text-cromo-num">{number}</span>
      ) : null}
      {hasMaterial && status != null ? (
        <span className="cromo-state">{status}</span>
      ) : null}
      {hasMaterial ? (
        <>
          <span aria-hidden className="cromo-gloss" />
          <span aria-hidden className="cromo-gleam" />
        </>
      ) : null}
      {isEmpty && children == null ? (
        <span aria-hidden className="text-cromo-num text-2xl opacity-60">
          ?
        </span>
      ) : (
        children
      )}
    </div>
  );
}

export { Cromo, cromoVariants };
