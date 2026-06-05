import { z } from 'zod';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/constants';

// El email se normaliza a minúsculas para que la unicidad sea insensible a
// mayúsculas (coherente con lib/db/seed/admin-bootstrap.ts).
const emailSchema = z
  .email({ message: 'Introduce un email válido.' })
  .transform((value) => value.toLowerCase().trim());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  token: z.string().min(1, 'Falta el token de invitación.'),
  email: emailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(60),
  apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios.').max(80),
  nickname: z
    .string()
    .trim()
    .min(2, 'El nick debe tener al menos 2 caracteres.')
    .max(30, 'El nick no puede superar 30 caracteres.'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const invitationSchema = z.object({
  note: z.string().trim().max(80, 'La nota no puede superar 80 caracteres.').optional(),
});
export type InvitationInput = z.infer<typeof invitationSchema>;
