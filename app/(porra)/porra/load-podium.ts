import { eq } from 'drizzle-orm';

import { db, matches, predictionsAwards, predictionsKnockout } from '@/lib/db';
import {
  deducePodium,
  type KnockoutPick,
  type PodiumDeduction,
} from '@/lib/scoring/deduce-podium';

// Los 3 puestos del podio guardados en BD (null = puesto vacío).
export type PodiumState = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

// Mapa de desincronización podio↔bracket por puesto. Lo conserva `podio-completion.ts`
// (helper puro). Vive aquí por compatibilidad de tipos; el flujo vivo del stepper
// usa `computePorraSummary` (lib/scoring/porra-summary.ts).
export type PodiumMismatches = {
  champion: boolean;
  runnerUp: boolean;
  third: boolean;
};

export type PodiumData = {
  // Lo que el usuario ha confirmado/guardado en predictions_awards. Puede estar
  // vacío si nunca tocó el podio.
  persisted: PodiumState;
  // Sugerencia derivada del bracket (deducePodium). NO se persiste: el tab la
  // muestra como "pendiente" para que el usuario la confirme o edite (ADR 0005).
  // Puede ser parcial o vacía.
  suggested: PodiumDeduction;
};

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

// Lectura PURA del podio (ADR 0005): devuelve lo guardado en BD y la sugerencia
// derivada del bracket. NO escribe nada. El prefill automático en el render del
// server component se eliminó (informe ultracode, CRÍTICO 2): persistir en un GET
// rompía la idempotencia y creaba una carrera con loadUserPredictions. La
// persistencia ocurre solo cuando el usuario confirma/edita un puesto vía la
// Server Action savePodiumPrediction.
export async function loadPodium(userId: number): Promise<PodiumData> {
  const [knockoutRows, awardRows] = await Promise.all([
    db
      .select({
        phase: matches.phase,
        winnerTeamCode: predictionsKnockout.winnerTeamCode,
      })
      .from(predictionsKnockout)
      .innerJoin(matches, eq(matches.id, predictionsKnockout.matchId))
      .where(eq(predictionsKnockout.userId, userId)),
    db
      .select({
        kind: predictionsAwards.kind,
        teamCode: predictionsAwards.teamCode,
      })
      .from(predictionsAwards)
      .where(eq(predictionsAwards.userId, userId)),
  ]);

  const picks: KnockoutPick[] = knockoutRows.map((r) => ({
    phase: r.phase,
    winnerTeamCode: r.winnerTeamCode,
  }));
  const suggested = deducePodium(picks);

  const podiumRows = awardRows.filter((r) =>
    (PODIUM_KINDS as readonly string[]).includes(r.kind),
  );

  return { persisted: toState(podiumRows), suggested };
}
