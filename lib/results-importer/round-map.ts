// Mapping del campo "round" de openfootball/worldcup.json a la fase canónica
// de `matches.phase` en nuestro esquema. Las fases que usa el repo son:
//
//   'grupos' | '1/16' | '1/8' | 'cuartos' | 'semi' | '3-4' | 'final'
//
// openfootball usa strings narrativos ("Matchday 1", "Round of 32", etc.).
// Se modelan solo los strings que aparecen en el JSON de 2026. Si surge uno
// no contemplado, devolvemos null y el orquestador lo loguea para que el
// admin lo revise — no inventamos mapeo.

import type { Phase } from '@/lib/db';

const ROUND_TO_PHASE: Record<string, Phase> = {
  // Fase de grupos: 3 matchdays.
  'Matchday 1': 'grupos',
  'Matchday 2': 'grupos',
  'Matchday 3': 'grupos',

  // Eliminatorias.
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
  return ROUND_TO_PHASE[key] ?? null;
}
