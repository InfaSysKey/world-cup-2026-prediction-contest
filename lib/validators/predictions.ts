import { z } from 'zod';

import { GROUP_LETTERS, MATCHES_GROUP_STAGE, MAX_GOLES } from '@/lib/constants';

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
