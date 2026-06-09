// Núcleo PURO del motor de puntuación. Recibe las predicciones del usuario y los
// resultados oficiales ya cargados (ScoringInputs) y devuelve una fila por cada
// categoría de `scores` (ScoreRow[]). No toca BD ni React: la carga y la
// persistencia las hace el orquestador (index.ts).
//
// Modelo de penalizaciones A (ADR de slice 5): las filas de categoría
// (group_matches, group_standings, best_thirds) llevan SOLO los puntos positivos;
// TODOS los −1 por hueco (§4) se centralizan en la fila `penalties`. Así el total
// del usuario es la suma limpia de las 7 filas y la penalización es auditable en
// un único sitio.

import { GROUP_LETTERS } from '@/lib/constants';
import type { ScoreCategory } from '@/lib/db';
import { SCORE_CATEGORIES } from '@/lib/db';

import type { AwardKind, AwardOfficial, AwardPicks } from './awards';
import { scoreAwards } from './awards';
import { scoreBestThirds } from './best-thirds';
import { scoreGroupMatch } from './group-matches';
import { scoreGroupStanding } from './group-standings';
import type { KnockoutPhase } from './knockout';
import { scoreKnockoutMatch } from './knockout';
import { scorePenalties } from './penalties';
import type { PodiumKind, PodiumOfficial, PodiumPicks } from './podium';
import { scorePodium } from './podium';

// --- Entrada: predicciones + oficiales ya normalizados por el loader ---

export type ScoringInputs = {
  groupMatches: ReadonlyArray<{
    matchId: number;
    cancelled: boolean;
    // null = sin resultado oficial todavía.
    official: { golesLocal: number; golesVisitante: number } | null;
    // null = el usuario no predijo este partido (hueco §4).
    prediction: { golesLocal: number; golesVisitante: number } | null;
  }>;
  groups: ReadonlyArray<{
    groupLetter: string;
    // Orden oficial [4], o null si el admin aún no lo introdujo.
    official: readonly string[] | null;
    // [4]; null en las posiciones que el usuario dejó vacías.
    predicted: ReadonlyArray<string | null>;
  }>;
  bestThirds: {
    official: readonly string[] | null;
    predicted: ReadonlyArray<string | null>;
  };
  knockout: ReadonlyArray<{
    matchId: number;
    phase: KnockoutPhase;
    cancelled: boolean;
    realWinnerTeamCode: string | null;
    pick: string | null;
  }>;
  podium: { picks: PodiumPicks; official: PodiumOfficial };
  awards: { picks: AwardPicks; official: AwardOfficial };
};

export type ScoreRow = {
  category: ScoreCategory;
  points: number;
  detail: Record<string, unknown>;
};

type GroupMatchReasonKey = 'exact' | 'result' | 'one_goal' | 'wrong';

export function computeScoreRows(inputs: ScoringInputs): ScoreRow[] {
  // --- §3.1 group_matches: solo puntos positivos; huecos → penalties ---
  let groupMatchPoints = 0;
  let groupMatchGaps = 0;
  const reasons: Record<GroupMatchReasonKey, number> = {
    exact: 0,
    result: 0,
    one_goal: 0,
    wrong: 0,
  };
  for (const m of inputs.groupMatches) {
    if (m.cancelled) {
      continue;
    }
    if (m.prediction === null) {
      groupMatchGaps += 1;
      continue;
    }
    if (m.official === null) {
      continue;
    }
    const s = scoreGroupMatch(m.prediction, { ...m.official, cancelled: false });
    if (s.reason !== 'empty' && s.reason !== 'cancelled') {
      reasons[s.reason] += 1;
      groupMatchPoints += s.points;
    }
  }

  // --- §3.2 group_standings ---
  let groupStandingPoints = 0;
  let groupStandingGaps = 0;
  let exactGroups = 0;
  for (const g of inputs.groups) {
    groupStandingGaps += g.predicted.filter((x) => x == null).length;
    if (g.official === null) {
      continue;
    }
    const s = scoreGroupStanding(g.predicted, g.official);
    groupStandingPoints += s.points;
    if (s.exactOrderBonus > 0) {
      exactGroups += 1;
    }
  }

  // --- §3.3 best_thirds ---
  const bestThirdGaps = inputs.bestThirds.predicted.filter(
    (x) => x == null,
  ).length;
  let bestThirdPoints = 0;
  let bestThirdHits = 0;
  let bestThirdBonus = 0;
  if (inputs.bestThirds.official !== null) {
    const s = scoreBestThirds(
      inputs.bestThirds.predicted,
      inputs.bestThirds.official,
    );
    bestThirdPoints = s.points;
    bestThirdHits = s.hits;
    bestThirdBonus = s.exactOrderBonus;
  }

  // --- §3.4 bracket ---
  let bracketPoints = 0;
  const hitsByPhase: Partial<Record<KnockoutPhase, number>> = {};
  for (const k of inputs.knockout) {
    if (k.realWinnerTeamCode === null) {
      continue;
    }
    const s = scoreKnockoutMatch(k.pick, {
      phase: k.phase,
      realWinnerTeamCode: k.realWinnerTeamCode,
      cancelled: k.cancelled,
    });
    bracketPoints += s.points;
    if (s.hit) {
      hitsByPhase[k.phase] = (hitsByPhase[k.phase] ?? 0) + 1;
    }
  }

  // --- §3.5 podium ---
  const podium = scorePodium(inputs.podium.picks, inputs.podium.official);
  const podiumPoints = podium.reduce((sum, s) => sum + s.points, 0);
  const podiumHits = podium
    .filter((s) => s.hit)
    .map((s) => s.kind as PodiumKind);

  // --- §3.6 awards ---
  const awards = scoreAwards(inputs.awards.picks, inputs.awards.official);
  const awardPoints = awards.reduce((sum, s) => sum + s.points, 0);
  const awardHits = awards.filter((s) => s.hit).map((s) => s.kind as AwardKind);

  // --- §4 penalties: centraliza los −1 de los huecos en 3.1–3.3 ---
  const penalties = scorePenalties({
    groupMatchGaps,
    groupStandingGaps,
    bestThirdGaps,
  });

  return [
    {
      category: 'group_matches',
      points: groupMatchPoints,
      detail: { reasons, gaps: groupMatchGaps },
    },
    {
      category: 'group_standings',
      points: groupStandingPoints,
      detail: { exactGroups, gaps: groupStandingGaps },
    },
    {
      category: 'best_thirds',
      points: bestThirdPoints,
      detail: { hits: bestThirdHits, bonus: bestThirdBonus, gaps: bestThirdGaps },
    },
    {
      category: 'bracket',
      points: bracketPoints,
      detail: { hitsByPhase },
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
    {
      category: 'penalties',
      points: penalties.points,
      detail: { groupMatchGaps, groupStandingGaps, bestThirdGaps },
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

const PODIUM_KINDS = new Set<AllAwardKind>(['champion', 'runner_up', 'third']);

export type ResultChange =
  | { type: 'group_match'; matchId: number }
  | { type: 'knockout'; matchId: number }
  | { type: 'group_standings'; groupLetter: string }
  | { type: 'best_thirds' }
  | { type: 'award'; awardKind: AllAwardKind };

// Mapea un cambio de resultado a las categorías de `scores` que hay que
// recalcular. NUNCA incluye `penalties`: las penalizaciones dependen solo de qué
// predicciones quedaron vacías (congeladas tras el bloqueo), no de los
// resultados, así que un cambio de resultado jamás las altera.
export function affectedCategoriesFor(change: ResultChange): ScoreCategory[] {
  switch (change.type) {
    case 'group_match':
      return ['group_matches'];
    case 'knockout':
      return ['bracket'];
    case 'group_standings':
      return ['group_standings'];
    case 'best_thirds':
      return ['best_thirds'];
    case 'award':
      return PODIUM_KINDS.has(change.awardKind) ? ['podium'] : ['awards'];
  }
}

// Reexport para que el orquestador y los tests compartan la lista canónica.
export { GROUP_LETTERS, SCORE_CATEGORIES };
