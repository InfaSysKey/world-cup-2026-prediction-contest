import { z } from 'zod';

import { GROUP_LETTERS, MAX_GOLES, PODIUM_AWARD_KINDS } from '@/lib/constants';
// Importamos los enum-as-const desde el schema (no desde @/lib/db) para no
// arrastrar el cliente de Postgres a un módulo de validación puro.
import { AWARD_KINDS } from '@/lib/db/schema';

const teamCode = z.string().trim().min(1, 'Falta el equipo.');
const goles = z.coerce
  .number()
  .int('Los goles deben ser un número entero.')
  .min(0, 'Los goles no pueden ser negativos.')
  .max(MAX_GOLES, `Máximo ${MAX_GOLES} goles por equipo.`);

// Resultado de un partido. `isKnockout` lo manda el formulario según la fase del
// partido; en eliminatorias el ganador es obligatorio (no se deduce del
// marcador, puede venir de penaltis). Que el ganador sea uno de los dos equipos
// del cruce se valida en la action, que conoce los equipos reales por BD.
export const matchResultSchema = z
  .object({
    matchId: z.coerce.number().int().positive(),
    isKnockout: z
      .union([z.literal('true'), z.literal('false')])
      .transform((v) => v === 'true'),
    golesLocal: goles,
    golesVisitante: goles,
    winnerTeamCode: z.string().trim().optional(),
  })
  .refine((v) => !v.isKnockout || Boolean(v.winnerTeamCode), {
    message: 'En eliminatorias debes indicar el ganador.',
    path: ['winnerTeamCode'],
  });
export type MatchResultInput = z.infer<typeof matchResultSchema>;

// Clasificación final de un grupo: 4 equipos en orden 1.º–4.º, todos distintos.
// Que pertenezcan al grupo se valida en la action (requiere la BD).
export const groupStandingSchema = z
  .object({
    groupLetter: z.enum(GROUP_LETTERS),
    teamCodes: z.array(teamCode).length(4, 'Debes ordenar los 4 equipos del grupo.'),
  })
  .refine((v) => new Set(v.teamCodes).size === 4, {
    message: 'No puedes repetir equipo en el orden del grupo.',
    path: ['teamCodes'],
  });
export type GroupStandingInput = z.infer<typeof groupStandingSchema>;

// Los 8 mejores terceros, en orden, todos distintos.
export const bestThirdsSchema = z
  .object({
    teamCodes: z.array(teamCode).length(8, 'Debes indicar los 8 mejores terceros.'),
  })
  .refine((v) => new Set(v.teamCodes).size === 8, {
    message: 'No puedes repetir equipo entre los mejores terceros.',
    path: ['teamCodes'],
  });
export type BestThirdsInput = z.infer<typeof bestThirdsSchema>;

const PODIUM_KINDS: readonly string[] = PODIUM_AWARD_KINDS;

// Premio oficial: el podio se guarda por equipo; botas/balones por jugador.
// Exactamente uno de los dos campos según el tipo (data-model.md §5.3).
export const actualAwardSchema = z
  .object({
    kind: z.enum(AWARD_KINDS),
    teamCode: z.string().trim().optional(),
    playerName: z.string().trim().max(80).optional(),
  })
  .refine(
    (v) =>
      PODIUM_KINDS.includes(v.kind)
        ? Boolean(v.teamCode) && !v.playerName
        : Boolean(v.playerName) && !v.teamCode,
    {
      message:
        'Indica el equipo para el podio o el jugador para botas/balones, no ambos.',
    },
  );
export type ActualAwardInput = z.infer<typeof actualAwardSchema>;
