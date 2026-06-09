import { asc, ne } from 'drizzle-orm';

import { db, matches } from '@/lib/db';
import type { KnockoutMatchRef } from '@/lib/scoring/resolve-bracket';

// Catálogo de los 32 cruces eliminatorios (1/16 → final + 3.º puesto) con su
// fase y sus slot_refs simbólicos. Es el mismo para todos los usuarios; no
// depende de sus predicciones. Lo consume el resolutor del bracket para saber
// qué dos lados disputa cada cruce (lib/scoring/resolve-bracket.ts).
export async function loadKnockoutMatches(): Promise<KnockoutMatchRef[]> {
  const rows = await db
    .select({
      id: matches.id,
      phase: matches.phase,
      homeSlotRef: matches.homeSlotRef,
      awaySlotRef: matches.awaySlotRef,
    })
    .from(matches)
    .where(ne(matches.phase, 'grupos'))
    .orderBy(asc(matches.id));

  return rows.flatMap((r) =>
    r.homeSlotRef && r.awaySlotRef
      ? [
          {
            id: r.id,
            phase: r.phase,
            homeSlotRef: r.homeSlotRef,
            awaySlotRef: r.awaySlotRef,
          },
        ]
      : [],
  );
}
