import type { PodiumMismatches, PodiumState } from './load-podium';

// Estado de completitud del tab Podio para el indicador del stepper. Función
// pura (sin BD ni React) para poder testear la regla de prioridad: un puesto
// desincronizado con el bracket gana a "completo" aunque los 3 campos tengan
// valor (el usuario debe revisar).
export type PodioCompletion = 'complete' | 'revisar' | 'partial' | 'empty';

export function podioCompletion(
  podium: PodiumState,
  mismatches: PodiumMismatches,
): PodioCompletion {
  if (mismatches.champion || mismatches.runnerUp || mismatches.third) {
    return 'revisar';
  }
  const filled = [podium.champion, podium.runnerUp, podium.third].filter(
    Boolean,
  ).length;
  if (filled >= 3) {
    return 'complete';
  }
  return filled > 0 ? 'partial' : 'empty';
}
