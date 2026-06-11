"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  // Los iconos se muestran por CSS según la clase .dark del <html> (la pone
  // next-themes antes del paint), así que no hay mismatch de hidratación ni hace
  // falta un guard de montaje. El "chip" replica el toggle del mockup (fondo
  // tenue --ink/7%) manteniendo el área táctil de 44px.
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-11 rounded-[10px] bg-ink/7 text-ink transition-transform hover:bg-ink/12 active:scale-95 [&_svg]:size-5",
        className,
      )}
      aria-label="Cambiar entre modo claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
