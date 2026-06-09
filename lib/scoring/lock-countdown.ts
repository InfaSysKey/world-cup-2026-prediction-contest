// Cuenta atrás de bloqueo de la porra (slice 7.5). Función PURA: recibe los
// pitidos iniciales de los partidos, el instante de bloqueo global y `now`,
// devuelve si la porra ya está bloqueada y cuántos partidos quedan hasta el
// cierre. Alimenta el indicador de la navbar; no toca BD ni React.
//
// MVP (scoring-rules.md §5): el bloqueo es global y coincide con el pitido del
// partido inaugural. "Faltan N" = partidos que arrancan tras `now` y hasta el
// bloqueo (incluido); el primero de ellos es el que dispara el cierre.

export type LockCountdown = {
  locked: boolean;
  remaining: number;
};

export function matchesUntilLock(
  matchTimes: readonly Date[],
  now: Date,
  lockAt: Date,
): LockCountdown {
  const nowMs = now.getTime();
  const lockMs = lockAt.getTime();
  if (nowMs >= lockMs) {
    return { locked: true, remaining: 0 };
  }
  const remaining = matchTimes.filter((t) => {
    const ms = t.getTime();
    return ms > nowMs && ms <= lockMs;
  }).length;
  return { locked: false, remaining };
}
