// Puntuación del bracket eliminatorio (scoring-rules.md §3.4). Función PURA: entra
// el ganador que el usuario predijo para un cruce (o null si lo dejó vacío) y el
// oficial del cruce (fase + ganador real + cancelado), sale { points, hit }. La
// carga de BD y la persistencia las hace el orquestador (lib/scoring/index.ts).
//
// Puntos por acertar el ganador: 1/16→4, 1/8→6, cuartos→10, semi→15, 3-4→12,
// final→25. Máx 219. Bracket RÍGIDO (ADR 0003): el acierto se cuenta solo si el
// equipo predicho es el que realmente ganó ESE cruce. Si por un fallo anterior el
// usuario colocó aquí a un equipo ya eliminado, el ganador real del cruce no
// coincidirá con su pick y el cruce no puntúa (no se "regenera" el bracket).
// Cruce vacío o anulado (§6.1) → 0, sin penalización (§4 no aplica al bracket).

import type { Phase } from '@/lib/db';

import { KNOCKOUT_PHASE_POINTS } from './points';

export type KnockoutPhase = Exclude<Phase, 'grupos'>;

export type KnockoutOfficial = {
  phase: KnockoutPhase;
  // Equipo que realmente ganó este cruce.
  realWinnerTeamCode: string;
  // Cruce anulado por retirada de un equipo (§6.1).
  cancelled: boolean;
};

export type KnockoutMatchScore = {
  points: number;
  hit: boolean;
};

export function scoreKnockoutMatch(
  pick: string | null,
  official: KnockoutOfficial,
): KnockoutMatchScore {
  if (official.cancelled || pick === null) {
    return { points: 0, hit: false };
  }
  if (pick === official.realWinnerTeamCode) {
    return { points: KNOCKOUT_PHASE_POINTS[official.phase], hit: true };
  }
  return { points: 0, hit: false };
}
