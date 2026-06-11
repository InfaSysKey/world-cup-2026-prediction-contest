import { playerAccent, playerInitials } from '@/lib/avatar';
import { cn } from '@/lib/utils';

// Avatar circular con iniciales y color de acento determinista por nick
// (design-system §10.6). Decorativo: el nombre accesible lo aporta el contenedor
// (p. ej. el aria-label del botón de cuenta), por eso va aria-hidden.

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-9 text-[13px]',
  md: 'size-11 text-[15px]',
  lg: 'size-12 text-[18px]',
};

type Props = {
  nick: string;
  size?: AvatarSize;
  className?: string;
};

export function PlayerAvatar({ nick, size = 'md', className }: Props) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: playerAccent(nick) }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-bold leading-none text-white shadow-sm',
        SIZES[size],
        className,
      )}
    >
      {playerInitials(nick)}
    </span>
  );
}
