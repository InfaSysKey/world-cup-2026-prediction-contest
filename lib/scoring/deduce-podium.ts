import type { Phase } from '@/lib/db';

// Deducción del podio a partir de la predicción de bracket (scoring-rules.md
// §2.6). Es PURA: entra la lista de ganadores predichos por fase, sale la
// sugerencia de los 3 puestos. Vive aquí (sin BD ni UI) para poder testearla y
// para que la consuman tanto el server component (prefill) como el cliente
// (líneas de sugerencia y avisos de desincronización con el bracket).
//
//   champion  = ganador del partido de fase 'final'.
//   third     = ganador del partido de fase '3-4'.
//   runner_up = el finalista que NO es campeón. Los dos finalistas son los
//               ganadores de las 2 semifinales; el subcampeón es la semifinal
//               cuyo ganador no ganó luego la final. Solo se puede deducir si
//               hay 2 semis predichas y el campeón es uno de esos 2 ganadores.

export type KnockoutPick = {
  phase: Phase;
  winnerTeamCode: string;
};

export type PodiumDeduction = {
  champion: string | null;
  runnerUp: string | null;
  third: string | null;
};

export function deducePodium(
  picks: readonly KnockoutPick[],
): PodiumDeduction {
  const champion = picks.find((p) => p.phase === 'final')?.winnerTeamCode ?? null;
  const third = picks.find((p) => p.phase === '3-4')?.winnerTeamCode ?? null;

  const semiWinners = picks
    .filter((p) => p.phase === 'semi')
    .map((p) => p.winnerTeamCode);

  let runnerUp: string | null = null;
  if (champion && semiWinners.length === 2 && semiWinners.includes(champion)) {
    runnerUp = semiWinners.find((c) => c !== champion) ?? null;
  }

  return { champion, runnerUp, third };
}

// ¿Hay algo deducible? Útil para decidir si merece la pena el prefill inicial.
export function hasAnyDeduction(d: PodiumDeduction): boolean {
  return d.champion !== null || d.runnerUp !== null || d.third !== null;
}
