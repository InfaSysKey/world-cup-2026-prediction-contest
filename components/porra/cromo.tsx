import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Cromo: la unidad visual del álbum (design-system §4, §5). Reemplaza el uso
// genérico de Card en las pantallas de dominio.
//   - normal: carta colocada (superficie + borde slot + micro-elevación).
//   - foil: el shiny holográfico, reservado al #1 y al campeón.
//   - empty: hueco del álbum (borde discontinuo + "?" tenue).

const cromoVariants = cva(
  "relative rounded-[14px] p-4 transition-[transform,box-shadow] duration-150 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        normal:
          "border border-slot bg-surface text-ink shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        foil: "cromo-foil bg-surface text-ink shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        empty:
          "flex items-center justify-center border border-dashed border-slot bg-bg text-ink-muted",
      },
    },
    defaultVariants: {
      variant: "normal",
    },
  },
);

type CromoProps = React.ComponentProps<"div"> &
  VariantProps<typeof cromoVariants>;

function Cromo({ className, variant = "normal", children, ...props }: CromoProps) {
  return (
    <div
      data-slot="cromo"
      data-variant={variant}
      className={cn(cromoVariants({ variant }), className)}
      {...props}
    >
      {variant === "empty" && children == null ? (
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
