import { Flag } from '@/components/porra/flag';
import { cn } from '@/lib/utils';

// Bandera + nombre en línea, el patrón repetido por toda la app (listas, bracket,
// calendario, lectura). flagCode null = sin equipo resoluble (slot del bracket):
// se muestra solo el texto.

type Props = {
  flagCode: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function TeamLabel({ flagCode, name, size = 'sm', className }: Props) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {flagCode ? <Flag code={flagCode} name={name} size={size} /> : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
