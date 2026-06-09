import { describe, expect, it } from 'vitest';

import { matchesUntilLock } from './lock-countdown';

// Indicador "Faltan N partidos para que se bloquee tu porra" (slice 7.5). Función
// PURA: entra el calendario de pitidos iniciales + el instante de bloqueo global
// (MVP: el pitido del partido inaugural) + ahora, sale cuántos partidos quedan
// hasta el bloqueo y si ya está bloqueada.
//
// En el MVP de bloqueo global, el cierre coincide con el inicio del primer
// partido; "faltan N" cuenta los partidos que arrancan tras `now` y hasta el
// bloqueo (incluido) — el siguiente de ellos es el que dispara el cierre.

const d = (iso: string) => new Date(iso);

const OPENER = d('2026-06-11T17:00:00Z');
const MATCH_TIMES = [
  OPENER,
  d('2026-06-11T20:00:00Z'),
  d('2026-06-12T17:00:00Z'),
];

describe('matchesUntilLock (7.5)', () => {
  it('antes del bloqueo: cuenta los partidos que arrancan hasta el cierre (incluido)', () => {
    // lockAt = inicio del torneo; solo el inaugural arranca a-o-antes del cierre.
    const result = matchesUntilLock(MATCH_TIMES, d('2026-06-10T00:00:00Z'), OPENER);
    expect(result).toEqual({ locked: false, remaining: 1 });
  });

  it('justo en el instante de bloqueo: bloqueada y 0 restantes', () => {
    const result = matchesUntilLock(MATCH_TIMES, OPENER, OPENER);
    expect(result).toEqual({ locked: true, remaining: 0 });
  });

  it('después del bloqueo: bloqueada y 0 restantes', () => {
    const result = matchesUntilLock(
      MATCH_TIMES,
      d('2026-06-12T00:00:00Z'),
      OPENER,
    );
    expect(result).toEqual({ locked: true, remaining: 0 });
  });

  it('no cuenta partidos que ya empezaron antes de now', () => {
    // lockAt más tardío para aislar la regla "scheduledAt > now".
    const lockAt = d('2026-06-12T18:00:00Z');
    const result = matchesUntilLock(
      MATCH_TIMES,
      d('2026-06-11T18:00:00Z'),
      lockAt,
    );
    // Quedan los de 20:00 del 11 y 17:00 del 12; el inaugural ya pasó.
    expect(result).toEqual({ locked: false, remaining: 2 });
  });

  it('calendario vacío → 0 restantes sin bloquear', () => {
    expect(matchesUntilLock([], d('2026-06-10T00:00:00Z'), OPENER)).toEqual({
      locked: false,
      remaining: 0,
    });
  });
});
