// Mapping del campo "round" de openfootball/worldcup.json a la fase canónica
// de `matches.phase` en nuestro esquema. Las fases que usa el repo son:
//
//   'grupos' | '1/16' | '1/8' | 'cuartos' | 'semi' | '3-4' | 'final'
//
// openfootball usa strings narrativos para los rounds:
//   - Fase de grupos: "Matchday N" donde N es el DÍA del torneo (1..~18), no el
//     número de partido del grupo. Es decir, "Matchday 8" agrupa partidos
//     jugados el día 8 del calendario, no la 8.ª jornada de cada grupo (no
//     existe tal cosa, son solo 3 por grupo). Por eso usamos regex.
//   - Eliminatorias: "Round of 32", "Round of 16", "Quarter-finals",
//     "Semi-finals", "Third-place playoff", "Final" — strings literales.
//
// Si surge un string no contemplado, devolvemos null y el orquestador lo
// loguea para que el admin lo revise — no inventamos mapeo.

import type { Phase } from '@/lib/db';

const MATCHDAY_REGEX = /^Matchday\s+\d+$/i;

const KNOCKOUT_ROUND_TO_PHASE: Record<string, Phase> = {
  'Round of 32': '1/16',
  'Round of 16': '1/8',
  'Quarter-finals': 'cuartos',
  Quarterfinals: 'cuartos',
  'Semi-finals': 'semi',
  Semifinals: 'semi',
  'Third-place playoff': '3-4',
  'Match for third place': '3-4',
  Final: 'final',
};

export function phaseFromOpenfootballRound(round: string): Phase | null {
  const key = round.trim();
  if (MATCHDAY_REGEX.test(key)) {
    return 'grupos';
  }
  return KNOCKOUT_ROUND_TO_PHASE[key] ?? null;
}
