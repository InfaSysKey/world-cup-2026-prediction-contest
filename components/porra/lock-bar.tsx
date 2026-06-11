import type { LockCountdown } from '@/lib/scoring/lock-countdown';
import { cn } from '@/lib/utils';

// Tira de estado del bloqueo de la porra (cuántos partidos faltan para el pitido
// inicial). Vive bajo la cabecera solo en páginas de jugador; en /admin no se
// muestra. Antes formaba parte de PorraNav; al separar la cabecera compartida
// (slice 10.1) pasa a ser su propio componente.

function lockMessage(lock: LockCountdown): string {
  if (lock.locked) {
    return 'Tu porra está bloqueada';
  }
  if (lock.remaining === 0) {
    return 'Tu porra se bloquea al empezar el torneo';
  }
  return `Faltan ${lock.remaining} partido${lock.remaining === 1 ? '' : 's'} para que se bloquee tu porra`;
}

export function LockBar({ lock }: { lock: LockCountdown }) {
  return (
    <div
      className={cn(
        'px-4 py-1.5 text-center text-xs',
        lock.locked
          ? 'bg-muted text-ink-muted'
          : 'bg-amber-400/10 text-amber-700 dark:text-amber-300',
      )}
    >
      {lockMessage(lock)}
    </div>
  );
}
