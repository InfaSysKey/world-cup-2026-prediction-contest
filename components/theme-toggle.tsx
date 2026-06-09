"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Los iconos se muestran por CSS según la clase .dark del <html> (la pone
  // next-themes antes del paint), así que no hay mismatch de hidratación ni hace
  // falta un guard de montaje.
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 [&_svg]:size-5"
      aria-label="Cambiar entre modo claro y oscuro"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
