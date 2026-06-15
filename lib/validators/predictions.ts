import { z } from 'zod';

import {
  GROUP_LETTERS,
  MATCHES_GROUP_STAGE,
  MATCHES_TOTAL,
  MAX_GOLES,
  PLAYER_NAME_MAX,
} from '@/lib/constants';

// Validadores Zod de las predicciones del formulario de porra.
//
// Reutilizables: los importan tanto el cliente (validación inmediata) como las
// Server Actions (validación de seguridad). Ver skill add-prediction-type §1.
// Se rellena categoría a categoría en las sub-slices 4.2+.

// --- Marcadores de fase de grupos (predictions_group_matches) ---

// Sin coerción: el batch llega como JSON con números, y queremos rechazar
// strings (un "2" no es un marcador válido) en lugar de convertirlos.
const goles = z
  .number()
  .int('Los goles deben ser un número entero.')
  .min(0, 'Los goles no pueden ser negativos.')
  .max(MAX_GOLES, `Máximo ${MAX_GOLES} goles por equipo.`);

export const groupMatchPredictionSchema = z.object({
  matchId: z.number().int().min(1).max(MATCHES_GROUP_STAGE),
  golesLocal: goles,
  golesVisitante: goles,
});
export type GroupMatchPredictionInput = z.infer<
  typeof groupMatchPredictionSchema
>;

export const groupMatchPredictionsBatchSchema = z.array(
  groupMatchPredictionSchema,
);
export type GroupMatchPredictionsBatchInput = z.infer<
  typeof groupMatchPredictionsBatchSchema
>;

// --- Orden de cada grupo (predictions_group_standings) ---

// Code ISO-3166 alpha-3 en mayúsculas (data-model.md §3.1). No validamos aquí
// la pertenencia del equipo al grupo: eso exige consultar `teams` y se hace en
// la Server Action.
const teamCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Código de equipo inválido.');

export const groupStandingPredictionSchema = z.object({
  groupLetter: z.enum([...GROUP_LETTERS]),
  position: z.number().int().min(1).max(4),
  teamCode,
});
export type GroupStandingPredictionInput = z.infer<
  typeof groupStandingPredictionSchema
>;

// El batch puede traer uno o varios grupos. Dentro de cada grupo, ni la posición
// ni el equipo pueden repetirse (data-model.md §4.2: UNIQUE (user,grupo,pos) y
// UNIQUE (user,grupo,equipo)).
export const groupStandingsBatchSchema = z
  .array(groupStandingPredictionSchema)
  .superRefine((entries, ctx) => {
    const seenPosition = new Set<string>();
    const seenTeam = new Set<string>();
    for (const e of entries) {
      const posKey = `${e.groupLetter}:${e.position}`;
      const teamKey = `${e.groupLetter}:${e.teamCode}`;
      if (seenPosition.has(posKey)) {
        ctx.addIssue({
          code: 'custom',
          message: `Posición ${e.position} repetida en el grupo ${e.groupLetter}.`,
        });
      }
      if (seenTeam.has(teamKey)) {
        ctx.addIssue({
          code: 'custom',
          message: `Equipo repetido en el grupo ${e.groupLetter}.`,
        });
      }
      seenPosition.add(posKey);
      seenTeam.add(teamKey);
    }
  });
export type GroupStandingsBatchInput = z.infer<
  typeof groupStandingsBatchSchema
>;

// --- Mejores terceros (predictions_best_thirds) ---

// Ranking de los 8 mejores terceros (scoring-rules.md §2.4). El batch puede
// llegar parcial (1–8 entradas): el guardado parcial está permitido. La
// coherencia con el 3.º de cada grupo es warning y se evalúa en cross-tab, no
// aquí; este schema solo garantiza forma y unicidad (replica los UNIQUE de BD).
export const bestThirdPredictionSchema = z.object({
  position: z.number().int().min(1).max(8),
  teamCode,
});
export type BestThirdPredictionInput = z.infer<
  typeof bestThirdPredictionSchema
>;

export const bestThirdsBatchSchema = z
  .array(bestThirdPredictionSchema)
  .max(8, 'No puede haber más de 8 mejores terceros.')
  .superRefine((entries, ctx) => {
    const seenPosition = new Set<number>();
    const seenTeam = new Set<string>();
    for (const e of entries) {
      if (seenPosition.has(e.position)) {
        ctx.addIssue({
          code: 'custom',
          message: `Posición ${e.position} repetida en los mejores terceros.`,
        });
      }
      if (seenTeam.has(e.teamCode)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Un mismo equipo no puede ocupar dos posiciones.',
        });
      }
      seenPosition.add(e.position);
      seenTeam.add(e.teamCode);
    }
  });
export type BestThirdsBatchInput = z.infer<typeof bestThirdsBatchSchema>;

// --- Bracket eliminatorio (predictions_knockout) ---

// El usuario predice ganador + marcador al 120' (90'+prórroga, sin penaltis,
// scoring-rules.md §3.3) por cada cruce. Los ids de eliminatorias van del 73 al
// 104 (data-model.md §4.4, seed/matches.ts).
//
// El winner es obligatorio (lo decide quién pasa a la siguiente ronda, por
// penaltis si el marcador queda empate). El marcador es opcional: registros
// previos a la v2.0 del reglamento no lo tienen, y un guardado parcial está
// permitido. Si ambos goles vienen y son distintos, en la Server Action se
// valida que el winner coincida con el lado mayor (necesita conocer
// home/away del match). La coherencia "ese equipo jugó realmente el cruce" es
// warning cross-tab (bracket rígido, ADR 0003).
const KNOCKOUT_MATCH_ID_MIN = MATCHES_GROUP_STAGE + 1;
const KNOCKOUT_MATCH_ID_MAX = MATCHES_TOTAL;

export const knockoutPredictionSchema = z.object({
  matchId: z
    .number()
    .int()
    .min(KNOCKOUT_MATCH_ID_MIN)
    .max(KNOCKOUT_MATCH_ID_MAX),
  winnerTeamCode: teamCode,
  golesLocal: goles.nullable().optional(),
  golesVisitante: goles.nullable().optional(),
});
export type KnockoutPredictionInput = z.infer<typeof knockoutPredictionSchema>;

// El bracket guarda SIEMPRE el snapshot completo de picks (no deltas sueltos):
// así el autosave puede colapsar pulsaciones rápidas sin perder ninguna
// (CRÍTICO 1 del informe ultracode). El matchId no puede repetirse en el batch.
export const knockoutPredictionsBatchSchema = z
  .array(knockoutPredictionSchema)
  .superRefine((entries, ctx) => {
    const seen = new Set<number>();
    for (const e of entries) {
      if (seen.has(e.matchId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Cruce ${e.matchId} repetido en el batch.`,
        });
      }
      seen.add(e.matchId);
    }
  });
export type KnockoutPredictionsBatchInput = z.infer<
  typeof knockoutPredictionsBatchSchema
>;

// --- Podio (predictions_awards, kinds champion/runner_up/third) ---

// El podio se guarda como un único objeto con los 3 puestos para validar la
// regla "los 3 equipos distintos" de forma atómica (scoring-rules.md §2.6,
// data-model.md §4.5). Cada puesto es nullable: el guardado parcial está
// permitido (el usuario puede tener solo el campeón deducido del bracket). La
// existencia del team_code en `teams` se comprueba en la Server Action.
// Este archivo lo amplía también la sub-slice 4.7 (premios boot_*/ball_*).
const podiumTeam = teamCode.nullable();

export const podiumPredictionSchema = z
  .object({
    champion: podiumTeam,
    runnerUp: podiumTeam,
    third: podiumTeam,
  })
  .superRefine((p, ctx) => {
    const filled = [p.champion, p.runnerUp, p.third].filter(
      (c): c is string => c !== null,
    );
    if (new Set(filled).size !== filled.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cada posición del podio debe ser un equipo diferente.',
      });
    }
  });
export type PodiumPredictionInput = z.infer<typeof podiumPredictionSchema>;

// --- Premios individuales (predictions_awards, kinds boot_*/ball_*) ---

// Los 9 kinds válidos de predictions_awards (data-model.md §4.5): podio por
// team_code + botas/balones por player_name. Schema combinado para validar el
// `kind` cuando llega suelto (lo importa quien necesite discriminar la fila).
export const awardKindSchema = z.enum([
  'champion',
  'runner_up',
  'third',
  'boot_gold',
  'boot_silver',
  'boot_bronze',
  'ball_gold',
  'ball_silver',
  'ball_bronze',
]);
export type AwardKind = z.infer<typeof awardKindSchema>;

// Texto libre, sin catálogo de jugadores: el admin normaliza nombres en slice 8
// si hace falta (decisión de producto que invalida el "autocompletado" de
// scoring-rules.md §2.7). Cada campo es nullable para permitir guardado parcial;
// un campo presente debe tener 1–PLAYER_NAME_MAX chars tras recortar espacios.
const playerName = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío.')
  .max(PLAYER_NAME_MAX, `Máximo ${PLAYER_NAME_MAX} caracteres.`)
  .nullable();

// "Mismo jugador" para la regla de distinción: ignora mayúsculas y espacios
// (los nombres ya llegan recortados por el .trim() del schema).
function hasDuplicatePlayers(names: (string | null)[]): boolean {
  const filled = names
    .filter((n): n is string => n !== null)
    .map((n) => n.toLowerCase());
  return new Set(filled).size !== filled.length;
}

export const playerAwardsPredictionSchema = z
  .object({
    bootGold: playerName,
    bootSilver: playerName,
    bootBronze: playerName,
    ballGold: playerName,
    ballSilver: playerName,
    ballBronze: playerName,
  })
  .superRefine((p, ctx) => {
    // Las 3 botas deben ser jugadores distintos entre sí; las 3 balones también.
    // PERO un jugador SÍ puede aparecer en bota Y en balón (Mbappé podría ser
    // bota de oro y balón de oro): no se cruza entre los dos grupos.
    if (hasDuplicatePlayers([p.bootGold, p.bootSilver, p.bootBronze])) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cada bota debe ser un jugador diferente.',
      });
    }
    if (hasDuplicatePlayers([p.ballGold, p.ballSilver, p.ballBronze])) {
      ctx.addIssue({
        code: 'custom',
        message: 'Cada balón debe ser un jugador diferente.',
      });
    }
  });
export type PlayerAwardsPredictionInput = z.infer<
  typeof playerAwardsPredictionSchema
>;
