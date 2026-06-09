import {
  BEST_THIRDS_COUNT,
  GROUP_LETTERS,
  MATCHES_GROUP_STAGE,
  MATCHES_KNOCKOUT,
} from '@/lib/constants';
import type { Phase } from '@/lib/db';
import { analyzeBestThirdsStale } from '@/lib/validators/cross-tab';

import { deducePodium, type KnockoutPick } from './deduce-podium';
import type { KnockoutMatchRef } from './resolve-bracket';

// Agregación global del estado de la porra (sub-slice 4.8). Función PURA: recibe
// las predicciones del usuario y el catálogo del torneo, devuelve el estado de
// cada tab (completa / incompleta / revisar), los huecos y las inconsistencias
// cruzadas. La consumen el stepper (status de cada tab), el sticky footer y el
// panel de revisión. No toca BD ni React.
//
// Es la ÚNICA fuente de verdad de la completitud: centraliza lo que antes cada
// tab calculaba por su cuenta (4.4–4.7) y añade las validaciones que cruzan ≥3
// tabs (bracket ↔ grupos+terceros).

export type MismatchTab = 'grupos' | 'terceros' | 'bracket' | 'podio' | 'premios';
export type MismatchSeverity = 'warning' | 'error';
export type MismatchFixAction = 'sync-to-bracket' | 'remove' | 'manual';

export type MismatchFix = {
  label: string;
  action: MismatchFixAction;
};

export type Mismatch = {
  // Identificador estable (para keys de React y deduplicar).
  id: string;
  tab: MismatchTab;
  // Selector/testid del elemento al que hacer scroll desde el panel.
  anchor: string;
  severity: MismatchSeverity;
  // Mensaje al usuario, en español.
  message: string;
  fix?: MismatchFix;
};

export type TabStatus = 'completa' | 'incompleta' | 'revisar';

export type TabSummary = {
  status: TabStatus;
  gaps: number;
  mismatches: Mismatch[];
};

export type PorraSummary = {
  tabs: {
    grupos: TabSummary;
    terceros: TabSummary;
    bracket: TabSummary;
    podio: TabSummary;
    premios: TabSummary;
  };
  overallStatus: TabStatus;
  totalGaps: number;
  totalMismatches: number;
  // Lista plana de todas las inconsistencias, ordenada por severidad (error
  // antes que warning) y luego por tab.
  mismatches: Mismatch[];
};

// --- Tipos de entrada (estructurales: aceptan las filas de BD tal cual) ---

export type SummaryPredictions = {
  groupMatches: readonly { matchId: number }[];
  groupStandings: readonly {
    groupLetter: string;
    position: number;
    teamCode: string;
  }[];
  bestThirds: readonly { position: number; teamCode: string }[];
  knockout: readonly { matchId: number; winnerTeamCode: string }[];
  awards: readonly {
    kind: string;
    teamCode: string | null;
    playerName: string | null;
  }[];
};

export type SummaryCatalog = {
  knockoutMatches: readonly KnockoutMatchRef[];
  // teamCode → groupLetter (catálogo `teams`).
  teamGroup: ReadonlyMap<string, string>;
  // teamCode → nombre en español, para mensajes legibles.
  teamName: ReadonlyMap<string, string>;
};

const GROUP_STANDINGS_SLOTS = GROUP_LETTERS.length * 4;
const PODIUM_SLOTS = 3;
const PREMIOS_SLOTS = 6;

const PHASE_LABEL: Record<Phase, string> = {
  grupos: 'la fase de grupos',
  '1/16': '1/16',
  '1/8': 'octavos',
  cuartos: 'cuartos',
  semi: 'semifinales',
  '3-4': 'el 3.º y 4.º puesto',
  final: 'la final',
};

const TAB_ORDER: Record<MismatchTab, number> = {
  grupos: 0,
  terceros: 1,
  bracket: 2,
  podio: 3,
  premios: 4,
};

function name(teamName: ReadonlyMap<string, string>, code: string): string {
  return teamName.get(code) ?? code;
}

function statusFrom(gaps: number, mismatches: Mismatch[]): TabStatus {
  if (mismatches.length > 0) {
    return 'revisar';
  }
  return gaps > 0 ? 'incompleta' : 'completa';
}

// --- Grupos: marcadores (72) + orden de los 12 grupos (48 posiciones) ---
function summarizeGrupos(p: SummaryPredictions): TabSummary {
  const matchGaps = Math.max(0, MATCHES_GROUP_STAGE - p.groupMatches.length);
  const standingGaps = Math.max(
    0,
    GROUP_STANDINGS_SLOTS - p.groupStandings.length,
  );
  const gaps = matchGaps + standingGaps;
  return { status: statusFrom(gaps, []), gaps, mismatches: [] };
}

// --- Mejores terceros: 8 + coherencia con el 3.º de cada grupo (stale) ---
function summarizeTerceros(
  p: SummaryPredictions,
  catalog: SummaryCatalog,
): TabSummary {
  const gaps = Math.max(0, BEST_THIRDS_COUNT - p.bestThirds.length);

  const stale = analyzeBestThirdsStale(
    p.groupStandings,
    p.bestThirds,
    catalog.teamGroup,
  );
  const mismatches: Mismatch[] = stale.map((s) => ({
    id: `terceros.stale.${s.teamCode}`,
    tab: 'terceros',
    anchor: `bt-stale-${s.teamCode}`,
    severity: 'warning',
    message: `${name(catalog.teamName, s.teamCode)} ya no es el 3.º de tu grupo ${s.groupLetter}; revísalo en Mejores Terceros.`,
  }));

  return { status: statusFrom(gaps, mismatches), gaps, mismatches };
}

// --- Bracket: 32 cruces + coherencia ganador ↔ equipo clasificado ---
function summarizeBracket(
  p: SummaryPredictions,
  catalog: SummaryCatalog,
): TabSummary {
  const gaps = Math.max(0, MATCHES_KNOCKOUT - p.knockout.length);

  // Equipos que, según las predicciones del usuario, clasifican a 1/16:
  // 1.º y 2.º de cada grupo + sus 8 mejores terceros.
  const qualified = new Set<string>();
  for (const s of p.groupStandings) {
    if (s.position === 1 || s.position === 2) {
      qualified.add(s.teamCode);
    }
  }
  for (const b of p.bestThirds) {
    qualified.add(b.teamCode);
  }

  // Posición predicha de cada equipo en su grupo, para explicar por qué no
  // clasifica (solo se delata a un equipo del que SÍ tenemos su posición).
  const standingByTeam = new Map(
    p.groupStandings.map((s) => [
      s.teamCode,
      { groupLetter: s.groupLetter, position: s.position },
    ]),
  );
  const phaseByMatch = new Map(
    catalog.knockoutMatches.map((m) => [m.id, m.phase]),
  );

  const mismatches: Mismatch[] = [];
  for (const pick of p.knockout) {
    const code = pick.winnerTeamCode;
    if (qualified.has(code)) {
      continue;
    }
    const st = standingByTeam.get(code);
    // Sin posición conocida no afirmamos nada (el usuario aún no ordenó ese
    // grupo): evita falsos positivos con la porra a medio rellenar.
    if (!st) {
      continue;
    }
    const phase = phaseByMatch.get(pick.matchId);
    const roundLabel = phase ? PHASE_LABEL[phase] : 'una eliminatoria';
    const reason =
      st.position === 3
        ? `queda 3.º del grupo ${st.groupLetter} y no está entre tus 8 mejores terceros`
        : `queda ${st.position}.º del grupo ${st.groupLetter}`;
    mismatches.push({
      id: `bracket.unqualified.${pick.matchId}.${code}`,
      tab: 'bracket',
      anchor: `bracket-match-${pick.matchId}`,
      severity: 'warning',
      message: `Has predicho que ${name(catalog.teamName, code)} gana ${roundLabel} pero según tus predicciones de fase de grupos ${reason}.`,
    });
  }

  return { status: statusFrom(gaps, mismatches), gaps, mismatches };
}

// --- Podio: 3 puestos + sincronía con el bracket + intra-podio distinto ---
function summarizePodio(
  p: SummaryPredictions,
  catalog: SummaryCatalog,
): TabSummary {
  const byKind = new Map(p.awards.map((a) => [a.kind, a.teamCode]));
  const podium = {
    champion: byKind.get('champion') ?? null,
    runnerUp: byKind.get('runner_up') ?? null,
    third: byKind.get('third') ?? null,
  };
  const filled = [podium.champion, podium.runnerUp, podium.third].filter(
    (c): c is string => c !== null,
  );
  const gaps = Math.max(0, PODIUM_SLOTS - filled.length);

  const mismatches: Mismatch[] = [];

  // Intra-podio: los 3 deben ser distintos (error duro, ya bloquea el guardado).
  if (new Set(filled).size !== filled.length) {
    mismatches.push({
      id: 'podio.duplicate',
      tab: 'podio',
      anchor: 'podio-duplicates-error',
      severity: 'error',
      message: 'Cada posición del podio debe ser un equipo diferente.',
    });
  }

  // Podio ↔ bracket: cada puesto debe coincidir con su deducción del bracket.
  const phaseByMatch = new Map(
    catalog.knockoutMatches.map((m) => [m.id, m.phase]),
  );
  const picks: KnockoutPick[] = p.knockout.flatMap((k) => {
    const phase = phaseByMatch.get(k.matchId);
    return phase ? [{ phase, winnerTeamCode: k.winnerTeamCode }] : [];
  });
  const deduction = deducePodium(picks);

  const SLOTS = [
    { kind: 'champion' as const, anchor: 'podio-field-champion', label: 'campeón' },
    { kind: 'runnerUp' as const, anchor: 'podio-field-runnerUp', label: 'subcampeón' },
    { kind: 'third' as const, anchor: 'podio-field-third', label: '3.º puesto' },
  ];
  for (const slot of SLOTS) {
    const expected = deduction[slot.kind];
    if (expected === null) {
      continue;
    }
    if (podium[slot.kind] !== expected) {
      mismatches.push({
        id: `podio.${slot.kind}.bracketMismatch`,
        tab: 'podio',
        anchor: slot.anchor,
        severity: 'warning',
        message: `Tu ${slot.label} no coincide con tu bracket (${name(catalog.teamName, expected)}).`,
        fix: { label: 'Sincronizar', action: 'sync-to-bracket' },
      });
    }
  }

  return { status: statusFrom(gaps, mismatches), gaps, mismatches };
}

// --- Premios: 6 nombres + botas distintas / balones distintos (sin cross-tab) ---
function summarizePremios(p: SummaryPredictions): TabSummary {
  const byKind = new Map(p.awards.map((a) => [a.kind, a.playerName]));
  const KINDS = [
    'boot_gold',
    'boot_silver',
    'boot_bronze',
    'ball_gold',
    'ball_silver',
    'ball_bronze',
  ];
  const filledCount = KINDS.filter((k) => {
    const v = byKind.get(k);
    return v !== null && v !== undefined && v.trim() !== '';
  }).length;
  const gaps = Math.max(0, PREMIOS_SLOTS - filledCount);

  const hasDuplicate = (kinds: string[]): boolean => {
    const names = kinds
      .map((k) => byKind.get(k))
      .filter((v): v is string => !!v && v.trim() !== '')
      .map((v) => v.trim().toLowerCase());
    return new Set(names).size !== names.length;
  };

  const mismatches: Mismatch[] = [];
  if (hasDuplicate(['boot_gold', 'boot_silver', 'boot_bronze'])) {
    mismatches.push({
      id: 'premios.boots.duplicate',
      tab: 'premios',
      anchor: 'premios-boots-error',
      severity: 'error',
      message: 'Cada bota debe ser un jugador diferente.',
    });
  }
  if (hasDuplicate(['ball_gold', 'ball_silver', 'ball_bronze'])) {
    mismatches.push({
      id: 'premios.balls.duplicate',
      tab: 'premios',
      anchor: 'premios-balls-error',
      severity: 'error',
      message: 'Cada balón debe ser un jugador diferente.',
    });
  }

  return { status: statusFrom(gaps, mismatches), gaps, mismatches };
}

function severityRank(s: MismatchSeverity): number {
  return s === 'error' ? 0 : 1;
}

export function computePorraSummary(
  predictions: SummaryPredictions,
  catalog: SummaryCatalog,
): PorraSummary {
  const tabs = {
    grupos: summarizeGrupos(predictions),
    terceros: summarizeTerceros(predictions, catalog),
    bracket: summarizeBracket(predictions, catalog),
    podio: summarizePodio(predictions, catalog),
    premios: summarizePremios(predictions),
  };

  const totalGaps =
    tabs.grupos.gaps +
    tabs.terceros.gaps +
    tabs.bracket.gaps +
    tabs.podio.gaps +
    tabs.premios.gaps;

  const mismatches = [
    ...tabs.grupos.mismatches,
    ...tabs.terceros.mismatches,
    ...tabs.bracket.mismatches,
    ...tabs.podio.mismatches,
    ...tabs.premios.mismatches,
  ].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    return bySeverity !== 0 ? bySeverity : TAB_ORDER[a.tab] - TAB_ORDER[b.tab];
  });

  const overallStatus: TabStatus =
    mismatches.length > 0
      ? 'revisar'
      : totalGaps > 0
        ? 'incompleta'
        : 'completa';

  return {
    tabs,
    overallStatus,
    totalGaps,
    totalMismatches: mismatches.length,
    mismatches,
  };
}
