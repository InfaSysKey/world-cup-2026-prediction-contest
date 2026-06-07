// Forma estándar de error y resultado para Server Actions y endpoints
// (CLAUDE.md §4.4, skill add-prediction-type §2). Los mensajes van en español y
// dirigidos al usuario final; el `code` en SCREAMING_SNAKE_CASE para el cliente.

export type ApiError = { code: string; message: string };

export type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };
