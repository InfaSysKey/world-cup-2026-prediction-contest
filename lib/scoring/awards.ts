// Puntuación de los premios individuales (scoring-rules.md §3.6). Función PURA:
// entra el jugador predicho por premio (nombre o null si vacío) y el oficial,
// sale un AwardScore por premio. Carga de BD y persistencia: en el orquestador.
//
// bota oro=15/plata=8/bronce=5, balón oro=12/plata=6/bronce=4. Máx 50. El match
// de nombres es case-insensitive + trim + sin tildes (decisión de 4.7): se
// comparan las formas normalizadas. Premio vacío o jugador que no participa
// (§6.6) → 0, sin penalización (§4 no aplica a premios). Separado de podium.ts.

import { AWARD_POINTS } from './points';

export type AwardKind = keyof typeof AWARD_POINTS;

export type AwardPicks = Record<AwardKind, string | null>;
export type AwardOfficial = Record<AwardKind, string | null>;

export type AwardScore = {
  kind: AwardKind;
  points: number;
  hit: boolean;
};

const AWARD_ORDER = Object.keys(AWARD_POINTS) as AwardKind[];

// Rango Unicode de las marcas diacríticas combinantes (acentos), para quitarlas
// tras descomponer con NFD.
const COMBINING_MARKS = /[\u0300-\u036f]/g;

// Normaliza un nombre de jugador para comparar: descompone los acentos y los
// elimina, colapsa espacios internos, recorta y pasa a minúsculas.
export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matches(pick: string | null, real: string | null): boolean {
  if (pick === null || real === null) {
    return false;
  }
  const normalizedPick = normalizePlayerName(pick);
  const normalizedReal = normalizePlayerName(real);
  if (normalizedPick === '' || normalizedReal === '') {
    return false;
  }
  return normalizedPick === normalizedReal;
}

export function scoreAwards(
  picks: AwardPicks,
  official: AwardOfficial,
): AwardScore[] {
  return AWARD_ORDER.map((kind) => {
    const hit = matches(picks[kind], official[kind]);
    return { kind, points: hit ? AWARD_POINTS[kind] : 0, hit };
  });
}
