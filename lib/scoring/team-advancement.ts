// Puntuación de "Equipos clasificados por fase" (scoring-rules.md §3.4, v2.0).
// Función PURA: por cada equipo que el usuario predijo y que efectivamente llega
// a una fase eliminatoria, 2 pts. La carga de BD (derivar qué equipos predijo
// para cada fase y qué equipos llegaron de verdad) la hace el orquestador
// (lib/scoring/index.ts).
//
// Categoría máx: 32+16+8+4+2+2 = 64 aciertos potenciales × 2 = 128 pts. Es
// ortogonal al marcador del cruce (§3.3) y al podio (§3.5): un mismo equipo
// puede sumar en varias categorías a la vez.

import type { Phase } from '@/lib/db';

import { TEAM_ADVANCEMENT_POINTS_PER_TEAM } from './points';

// Las fases eliminatorias en el orden del Excel canónico. '3-4' va antes que
// 'final' porque así está numerada en el Excel y así se itera el detalle.
export const TEAM_ADVANCEMENT_PHASES = [
  '1/16',
  '1/8',
  'cuartos',
  'semi',
  '3-4',
  'final',
] as const satisfies readonly Exclude<Phase, 'grupos'>[];

export type TeamAdvancementPhase = (typeof TEAM_ADVANCEMENT_PHASES)[number];

export type TeamAdvancementInputs = {
  // Equipos que el usuario predijo que llegarían a cada fase. Para '1/16' son
  // los 32 derivados de su predicción de standings (1.º/2.º de cada grupo) +
  // mejores terceros. Para el resto, los ganadores predichos en la ronda previa.
  // Para '3-4', los perdedores predichos en semis.
  predicted: Record<TeamAdvancementPhase, ReadonlyArray<string>>;
  // Equipos POSITIVAMENTE confirmados hasta ahora en cada fase, derivados de los
  // resultados oficiales. Puede estar incompleto: la puntuación es por-equipo
  // (scoring-rules.md §3.4, ADR 0013), así que un set parcial igualmente suma
  // los aciertos confirmados sin penalizar los todavía desconocidos. Null
  // significa "no hay nada confirmado todavía" y devuelve 0 pts en esa fase.
  actual: Record<TeamAdvancementPhase, ReadonlyArray<string> | null>;
};

export type TeamAdvancementPhaseScore = {
  phase: TeamAdvancementPhase;
  // Equipos acertados (intersección predicted ∩ actual).
  hits: number;
  // hits × 2.
  points: number;
};

export type TeamAdvancementScore = {
  points: number;
  byPhase: TeamAdvancementPhaseScore[];
};

export function scoreTeamAdvancement(
  inputs: TeamAdvancementInputs,
): TeamAdvancementScore {
  let total = 0;
  const byPhase: TeamAdvancementPhaseScore[] = [];

  for (const phase of TEAM_ADVANCEMENT_PHASES) {
    const actual = inputs.actual[phase];
    if (actual === null) {
      byPhase.push({ phase, hits: 0, points: 0 });
      continue;
    }
    const actualSet = new Set(actual);
    const predicted = inputs.predicted[phase];
    const seen = new Set<string>();
    let hits = 0;
    for (const team of predicted) {
      if (seen.has(team)) {
        continue;
      }
      seen.add(team);
      if (actualSet.has(team)) {
        hits += 1;
      }
    }
    const points = hits * TEAM_ADVANCEMENT_POINTS_PER_TEAM;
    total += points;
    byPhase.push({ phase, hits, points });
  }

  return { points: total, byPhase };
}
