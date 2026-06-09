// Puntuación del cuadro de honor / podio (scoring-rules.md §3.5). Función PURA:
// entra el podio predicho por el usuario {champion, runner_up, third} (cada uno
// teamCode o null si vacío) y el podio oficial, sale un PodiumScore por puesto.
// Carga de BD y persistencia: en el orquestador (lib/scoring/index.ts).
//
// champion=20, runner_up=12, third=8. Son ADICIONALES a los puntos del bracket
// (§3.5): un acierto en la final suma sus 25 (bracket) Y los 20 del campeón.
// Puesto vacío o fallado → 0, sin penalización (§4 no aplica al podio). Máx 40.

import { PODIUM_POINTS } from './points';

export type PodiumKind = 'champion' | 'runner_up' | 'third';

export type PodiumPicks = Record<PodiumKind, string | null>;
export type PodiumOfficial = Record<PodiumKind, string | null>;

export type PodiumScore = {
  kind: PodiumKind;
  points: number;
  hit: boolean;
};

const PODIUM_ORDER: readonly PodiumKind[] = ['champion', 'runner_up', 'third'];

export function scorePodium(
  picks: PodiumPicks,
  official: PodiumOfficial,
): PodiumScore[] {
  return PODIUM_ORDER.map((kind) => {
    const pick = picks[kind];
    const real = official[kind];
    const hit = pick !== null && real !== null && pick === real;
    return { kind, points: hit ? PODIUM_POINTS[kind] : 0, hit };
  });
}
