import {
  deducePodium,
  type KnockoutPick,
  type PodiumDeduction,
} from '@/lib/scoring/deduce-podium';
import type { KnockoutMatchRef } from '@/lib/scoring/resolve-bracket';

// Los 3 puestos del podio guardados en BD (null = puesto vacío).
export type PodiumState = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

// Mapa de desincronización podio↔bracket por puesto. Lo conserva
// `podio-completion.ts` (helper puro). Vive aquí por compatibilidad de tipos; el
// flujo vivo del stepper usa `computePorraSummary` (lib/scoring/porra-summary.ts).
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

const PODIUM_KINDS: ReadonlySet<string> = new Set([
  'champion',
  'runner_up',
  'third',
]);

function toState(
  rows: readonly { kind: string; teamCode: string | null }[],
): PodiumState {
  const byKind = new Map(rows.map((r) => [r.kind, r.teamCode]));
  return {
    champion: byKind.get('champion') ?? null,
    runnerUp: byKind.get('runner_up') ?? null,
    third: byKind.get('third') ?? null,
  };
}

// Deriva el podio (lo guardado + la sugerencia del bracket) a partir de las
// predicciones que el server component YA cargó (load-predictions.ts) y del
// catálogo de cruces. PURA: sin BD ni escritura (ADR 0005). No vuelve a consultar
// predictions_awards / predictions_knockout, que loadUserPredictions ya trae
// (evita las consultas duplicadas señaladas en el informe ultracode, MINOR 7).
export function derivePodium(
  awards: readonly { kind: string; teamCode: string | null }[],
  knockout: readonly { matchId: number; winnerTeamCode: string }[],
  knockoutMatches: readonly KnockoutMatchRef[],
): PodiumData {
  const phaseByMatch = new Map(knockoutMatches.map((m) => [m.id, m.phase]));
  const picks: KnockoutPick[] = knockout.flatMap((k) => {
    const phase = phaseByMatch.get(k.matchId);
    return phase ? [{ phase, winnerTeamCode: k.winnerTeamCode }] : [];
  });
  const suggested = deducePodium(picks);

  const podiumRows = awards.filter((a) => PODIUM_KINDS.has(a.kind));
  return { persisted: toState(podiumRows), suggested };
}
