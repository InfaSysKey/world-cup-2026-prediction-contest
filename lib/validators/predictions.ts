import { z } from 'zod';

import { MATCHES_GROUP_STAGE, MAX_GOLES } from '@/lib/constants';

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
