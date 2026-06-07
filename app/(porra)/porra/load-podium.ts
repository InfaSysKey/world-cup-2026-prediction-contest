import { eq } from 'drizzle-orm';

import {
  db,
  matches,
  predictionsAwards,
  predictionsKnockout,
} from '@/lib/db';
import {
  deducePodium,
  hasAnyDeduction,
  type KnockoutPick,
  type PodiumDeduction,
} from '@/lib/scoring/deduce-podium';
import { isAwardsPredictionLocked } from '@/lib/scoring/locks';
import { analyzePodiumBracketMismatch } from '@/lib/validators/cross-tab';

// Los 3 puestos del podio guardados en BD (null = puesto vacío).
export type PodiumState = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

// Por puesto: true si el valor guardado no coincide con el deducido del bracket.
// Es la fuente de verdad que consume el stepper para decidir "revisar" sin
// recalcular la lógica de desincronización (cross-tab.ts).
export type PodiumMismatches = {
  champion: boolean;
  runnerUp: boolean;
  third: boolean;
};

export type PodiumData = {
  // Valores actuales en BD (tras el posible prefill inicial).
  podium: PodiumState;
  // Sugerencia derivada del bracket, para las líneas de ayuda y los avisos de
  // desincronización en el tab.
  deduction: PodiumDeduction;
  // Mapa de desincronización podio↔bracket calculado server-side.
  mismatches: PodiumMismatches;
};

function toMismatches(podium: PodiumState, deduction: PodiumDeduction): PodiumMismatches {
  const byKind = new Set(
    analyzePodiumBracketMismatch(podium, deduction).map((m) => m.kind),
  );
  return {
    champion: byKind.has('champion'),
    runnerUp: byKind.has('runnerUp'),
    third: byKind.has('third'),
  };
}

const PODIUM_KINDS = ['champion', 'runner_up', 'third'] as const;

function toState(
  rows: { kind: string; teamCode: string | null }[],
): PodiumState {
  const byKind = new Map(rows.map((r) => [r.kind, r.teamCode]));
  return {
    champion: byKind.get('champion') ?? null,
    runnerUp: byKind.get('runner_up') ?? null,
    third: byKind.get('third') ?? null,
  };
}

// Carga el podio del usuario y, si NUNCA lo ha tocado (cero filas de podio) y el
// bracket permite deducir algo, hace un prefill server-side ANTES de renderizar
// (sub-slice 4.6). Una vez existe alguna fila, la BD es la fuente de verdad y no
// se vuelve a auto-rellenar.
export async function loadPodium(userId: number): Promise<PodiumData> {
  const [knockoutRows, awardRows] = await Promise.all([
    db
      .select({ phase: matches.phase, winnerTeamCode: predictionsKnockout.winnerTeamCode })
      .from(predictionsKnockout)
      .innerJoin(matches, eq(matches.id, predictionsKnockout.matchId))
      .where(eq(predictionsKnockout.userId, userId)),
    db
      .select({ kind: predictionsAwards.kind, teamCode: predictionsAwards.teamCode })
      .from(predictionsAwards)
      .where(eq(predictionsAwards.userId, userId)),
  ]);

  const picks: KnockoutPick[] = knockoutRows.map((r) => ({
    phase: r.phase,
    winnerTeamCode: r.winnerTeamCode,
  }));
  const deduction = deducePodium(picks);

  const podiumRows = awardRows.filter((r) =>
    (PODIUM_KINDS as readonly string[]).includes(r.kind),
  );

  // Prefill solo si el usuario no tiene NINGUNA fila de podio todavía, hay algo
  // deducible y la categoría no está bloqueada (no escribimos tras el cierre).
  if (
    podiumRows.length === 0 &&
    hasAnyDeduction(deduction) &&
    !isAwardsPredictionLocked()
  ) {
    const inserts = [
      { kind: 'champion' as const, teamCode: deduction.champion },
      { kind: 'runner_up' as const, teamCode: deduction.runnerUp },
      { kind: 'third' as const, teamCode: deduction.third },
    ].filter(
      (e): e is { kind: typeof e.kind; teamCode: string } => e.teamCode !== null,
    );

    // onConflictDoNothing por seguridad ante una doble carga concurrente: el
    // prefill es best-effort, no debe romper el render.
    await db
      .insert(predictionsAwards)
      .values(inserts.map((e) => ({ userId, kind: e.kind, teamCode: e.teamCode })))
      .onConflictDoNothing({
        target: [predictionsAwards.userId, predictionsAwards.kind],
      });

    const podium = toState(inserts);
    return { podium, deduction, mismatches: toMismatches(podium, deduction) };
  }

  const podium = toState(podiumRows);
  return { podium, deduction, mismatches: toMismatches(podium, deduction) };
}
