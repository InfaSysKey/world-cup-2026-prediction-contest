// Tipos y validador Zod del JSON de openfootball/worldcup.json (versión Mundial
// 2026). Modelado a partir de inspección directa del fichero:
// https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
//
// Solo modelamos los campos que nos importan para puntuar. Los campos extra que
// pueda traer el JSON (goleadores, alineaciones, etc.) no participan en el
// scoring y se descartan vía `.passthrough()` para no romper si openfootball
// añade información en el futuro.
//
// Política de tolerancia: el JSON puede traer partidos sin `score` (aún no
// jugados), con `ft` parcial al descanso (no debería pero por si acaso) o sin
// `et`/`p` cuando no aplican. Lo validamos con campos opcionales y el módulo
// `apply-scores` decide qué partido se da por finalizado.

import { z } from 'zod';

// Una pareja de goles [local, visitante]. Cualquier número no negativo.
const goalsPairSchema = z
  .tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)])
  .describe('[goles_local, goles_visitante]');

const matchScoreSchema = z
  .object({
    ft: goalsPairSchema.optional(), // 90 minutos
    ht: goalsPairSchema.optional(), // medio tiempo
    et: goalsPairSchema.optional(), // 120 minutos (90 + prórroga)
    p: goalsPairSchema.optional(), // penaltis
  })
  .strict();

export const openfootballMatchSchema = z
  .object({
    round: z.string(),
    date: z.string(), // ISO 'YYYY-MM-DD'
    time: z.string().optional(), // 'HH:MM UTC-6' u otros formatos
    team1: z.string(),
    team2: z.string(),
    score: matchScoreSchema.optional(),
    group: z.string().optional(),
    ground: z.string().optional(),
  })
  .passthrough();

export const openfootballFileSchema = z
  .object({
    name: z.string(),
    matches: z.array(openfootballMatchSchema),
  })
  .passthrough();

export type OpenfootballMatch = z.infer<typeof openfootballMatchSchema>;
export type OpenfootballFile = z.infer<typeof openfootballFileSchema>;
