// Núcleo PURO del motor de puntuación v2.0 (scoring-rules.md §9). Recibe las
// predicciones del usuario y los resultados oficiales ya cargados (ScoringInputs)
// y devuelve una fila por cada una de las 6 categorías de `scores` (ScoreRow[]).
// No toca BD ni React: la carga y la persistencia las hace el orquestador
// (index.ts).
//
// Categorías v2.0: group_matches, group_standings, bracket, team_advancement,
// podium, awards. Se eliminaron `best_thirds` (predicción se mantiene como input
// del bracket pero ya no puntúa) y `penalties` (v2.0 no penaliza huecos).

import { GROUP_LETTERS, PODIUM_AWARD_KINDS } from '@/lib/constants';
import type { ScoreCategory } from '@/lib/db';
import { SCORE_CATEGORIES } from '@/lib/db';

import type { AwardOfficial, AwardPicks } from './awards';
import { scoreAwards } from './awards';
import type { GroupMatchReason } from './group-matches';
import { scoreGroupMatch } from './group-matches';
import { scoreGroupStanding } from './group-standings';
import type { KnockoutMatchReason } from './knockout';
import { scoreKnockoutMatch } from './knockout';
import type { PodiumOfficial, PodiumPicks } from './podium';
import { scorePodium } from './podium';
import type {
  TeamAdvancementInputs,
  TeamAdvancementPhase,
} from './team-advancement';
import { scoreTeamAdvancement } from './team-advancement';

// --- Entrada: predicciones + oficiales ya normalizados por el loader ---

export type ScoringInputs = {
  groupMatches: ReadonlyArray<{
    matchId: number;
    cancelled: boolean;
    // null = sin resultado oficial todavía.
    official: { golesLocal: number; golesVisitante: number } | null;
    // null = el usuario no predijo este partido.
    prediction: { golesLocal: number; golesVisitante: number } | null;
  }>;
  groups: ReadonlyArray<{
    groupLetter: string;
    // Orden oficial [4], o null si el admin aún no lo introdujo.
    official: readonly string[] | null;
    // [4]; null en las posiciones que el usuario dejó vacías.
    predicted: ReadonlyArray<string | null>;
  }>;
  // Marcador predicho y oficial para cada uno de los 32 cruces. El acierto del
  // ganador del cruce (quien pasa a la siguiente fase) se mide en
  // `teamAdvancement`, no aquí.
  knockoutMarkers: ReadonlyArray<{
    matchId: number;
    phase: TeamAdvancementPhase;
    cancelled: boolean;
    official: { golesLocal: number; golesVisitante: number } | null;
    prediction: { golesLocal: number; golesVisitante: number } | null;
  }>;
  teamAdvancement: TeamAdvancementInputs;
  podium: { picks: PodiumPicks; official: PodiumOfficial };
  awards: { picks: AwardPicks; official: AwardOfficial };
};

export type ScoreRow = {
  category: ScoreCategory;
  points: number;
  detail: Record<string, unknown>;
};

type GroupReasonCounts = Record<Exclude<GroupMatchReason, 'cancelled'>, number>;
type KnockoutReasonCounts = Record<
  Exclude<KnockoutMatchReason, 'cancelled'>,
  number
>;

export function computeScoreRows(inputs: ScoringInputs): ScoreRow[] {
  // --- §3.1 group_matches ---
  let groupMatchPoints = 0;
  const groupReasons: GroupReasonCounts = {
    exact: 0,
    result: 0,
    wrong: 0,
    empty: 0,
  };
  for (const m of inputs.groupMatches) {
    if (m.cancelled) {
      continue;
    }
    if (m.official === null) {
      // Sin resultado oficial: no puntúa ni cuenta como hueco; cuando llegue,
      // se recalculará.
      continue;
    }
    const s = scoreGroupMatch(m.prediction, { ...m.official, cancelled: false });
    if (s.reason !== 'cancelled') {
      groupReasons[s.reason] += 1;
    }
    groupMatchPoints += s.points;
  }

  // --- §3.2 group_standings ---
  let groupStandingPoints = 0;
  let groupStandingEmpty = 0;
  for (const g of inputs.groups) {
    groupStandingEmpty += g.predicted.filter((x) => x == null).length;
    if (g.official === null) {
      continue;
    }
    const s = scoreGroupStanding(g.predicted, g.official);
    groupStandingPoints += s.points;
  }

  // --- §3.3 bracket (marcador de cruces eliminatorios) ---
  let bracketPoints = 0;
  const knockoutReasons: KnockoutReasonCounts = {
    exact: 0,
    result: 0,
    wrong: 0,
    empty: 0,
  };
  const exactKnockoutByPhase: Partial<Record<TeamAdvancementPhase, number>> = {};
  for (const k of inputs.knockoutMarkers) {
    if (k.cancelled) {
      continue;
    }
    if (k.official === null) {
      continue;
    }
    const s = scoreKnockoutMatch(k.prediction, {
      ...k.official,
      cancelled: false,
    });
    if (s.reason !== 'cancelled') {
      knockoutReasons[s.reason] += 1;
    }
    bracketPoints += s.points;
    if (s.reason === 'exact') {
      exactKnockoutByPhase[k.phase] = (exactKnockoutByPhase[k.phase] ?? 0) + 1;
    }
  }

  // --- §3.4 team_advancement (equipos clasificados por fase) ---
  const advancement = scoreTeamAdvancement(inputs.teamAdvancement);

  // --- §3.5 podium ---
  const podium = scorePodium(inputs.podium.picks, inputs.podium.official);
  const podiumPoints = podium.reduce((sum, s) => sum + s.points, 0);
  const podiumHits = podium.filter((s) => s.hit).map((s) => s.kind);

  // --- §3.6 awards ---
  const awards = scoreAwards(inputs.awards.picks, inputs.awards.official);
  const awardPoints = awards.reduce((sum, s) => sum + s.points, 0);
  const awardHits = awards.filter((s) => s.hit).map((s) => s.kind);

  return [
    {
      category: 'group_matches',
      points: groupMatchPoints,
      detail: { reasons: groupReasons },
    },
    {
      category: 'group_standings',
      points: groupStandingPoints,
      detail: { emptyPositions: groupStandingEmpty },
    },
    {
      category: 'bracket',
      points: bracketPoints,
      detail: {
        reasons: knockoutReasons,
        exactByPhase: exactKnockoutByPhase,
      },
    },
    {
      category: 'team_advancement',
      points: advancement.points,
      detail: { byPhase: advancement.byPhase },
    },
    {
      category: 'podium',
      points: podiumPoints,
      detail: { hits: podiumHits },
    },
    {
      category: 'awards',
      points: awardPoints,
      detail: { hits: awardHits },
    },
  ];
}

// --- Recálculo selectivo: qué categorías toca cada tipo de cambio del admin ---

export const ALL_AWARD_KINDS = [
  'champion',
  'runner_up',
  'third',
  'boot_gold',
  'boot_silver',
  'boot_bronze',
  'ball_gold',
  'ball_silver',
  'ball_bronze',
] as const;
export type AllAwardKind = (typeof ALL_AWARD_KINDS)[number];

const PODIUM_KINDS = new Set<AllAwardKind>(PODIUM_AWARD_KINDS);

export type ResultChange =
  | { type: 'group_match'; matchId: number }
  | { type: 'knockout'; matchId: number }
  | { type: 'group_standings'; groupLetter: string }
  | { type: 'best_thirds' }
  | { type: 'award'; awardKind: AllAwardKind };

// Mapea un cambio de resultado a las categorías de `scores` que hay que
// recalcular en v2.0.
//   - group_match: afecta solo a 'group_matches' (5/3/0 por marcador).
//   - knockout: afecta a 'bracket' (5/3/0 por marcador) Y a 'team_advancement'
//     (el ganador real cambia qué equipos llegan a cada fase posterior).
//   - group_standings: afecta a 'group_standings' (posiciones acertadas) Y a
//     'team_advancement' (los 1.º/2.º oficiales son input de "clasificados a
//     1/16").
//   - best_thirds: oficial de los 8 mejores terceros → afecta solo a
//     'team_advancement' (input de "clasificados a 1/16"). En v2.0 la categoría
//     'best_thirds' ya no existe.
//   - award: 'podium' o 'awards' según el kind.
export function affectedCategoriesFor(change: ResultChange): ScoreCategory[] {
  switch (change.type) {
    case 'group_match':
      return ['group_matches'];
    case 'knockout':
      return ['bracket', 'team_advancement'];
    case 'group_standings':
      return ['group_standings', 'team_advancement'];
    case 'best_thirds':
      return ['team_advancement'];
    case 'award':
      return PODIUM_KINDS.has(change.awardKind) ? ['podium'] : ['awards'];
  }
}

// Reexport para que el orquestador y los tests compartan la lista canónica.
export { GROUP_LETTERS, SCORE_CATEGORIES };
