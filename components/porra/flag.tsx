import { cn } from '@/lib/utils';

// Bandera real (imagen SVG vía flag-icons), no emoji: arregla el render roto en
// Windows/Chrome (slice 10.4). El tamaño y el background-size van por inline-style
// para ganar a la CSS del paquete sin pelear con las capas de Tailwind.
//
// Decorativa: siempre aparece junto al nombre del equipo, así que va aria-hidden
// (el nombre adyacente da el dato); `name` queda como tooltip.

type FlagSize = 'sm' | 'md' | 'lg';

const SIZES: Record<FlagSize, { width: string; height: string }> = {
  sm: { width: '1.5rem', height: '1rem' }, // 24×16
  md: { width: '1.75rem', height: '1.25rem' }, // 28×20
  lg: { width: '2.5rem', height: '1.75rem' }, // 40×28
};

type Props = {
  code: string;
  name: string;
  size?: FlagSize;
  className?: string;
};

export function Flag({ code, name, size = 'sm', className }: Props) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        `fi fi-${code}`,
        'inline-block shrink-0 rounded-[3px] shadow-sm',
        className,
      )}
      style={{ ...SIZES[size], backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  );
}
