---
name: add-api-route
description: Use this skill when creating or modifying API endpoints in app/api/ or Server Actions in any route group. Triggers when the user mentions API route, endpoint, Server Action, /api/, route handler, or asks to expose backend functionality.
---

# add-api-route

Workflow obligatorio para crear o modificar cualquier endpoint del backend, sea API route (`app/api/.../route.ts`) o Server Action (`'use server'`).

## Preferencia por defecto

**Server Action > API route**. Si el endpoint solo lo consume nuestro frontend Next.js, va como Server Action. API route solo si lo consume un cliente externo (curl, otro servicio, futuro mobile…). En este proyecto, el 95% son Server Actions.

## Estructura obligatoria de cualquier endpoint

Todo endpoint pasa por estos 6 bloques en este orden. Sin atajos.

### 1. Validar input con Zod

```typescript
import { z } from 'zod';

const inputSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72), // 72 = límite bcrypt
});

// En Server Action:
const parsed = inputSchema.safeParse(Object.fromEntries(formData));
if (!parsed.success) {
  return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.', fields: parsed.error.flatten().fieldErrors } };
}
```

Los validadores reutilizables van en `lib/validators/`. No dupliques esquemas entre Server Action y validación cliente.

### 2. Comprobar autenticación

Por defecto **todo endpoint requiere sesión**. Lista blanca explícita en `lib/auth/public-routes.ts` para excepciones (`/login`, `/registro?token=`).

```typescript
import { getCurrentUser } from '@/lib/auth/current-user';

const user = await getCurrentUser();
if (!user) {
  return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
}
```

### 3. Comprobar autorización si aplica

Si el endpoint es de admin:

```typescript
if (!user.isAdmin) {
  return { error: { code: 'FORBIDDEN', message: 'Acceso reservado al administrador.' } };
}
```

Si el endpoint actúa sobre datos de un usuario (predicciones, perfil), verifica **siempre** que el `userId` del recurso coincide con `user.id` (anti-IDOR). No te fíes del cliente.

### 4. Ejecutar la lógica

La lógica de negocio vive en `lib/`, no en el endpoint. El endpoint orquesta:

```typescript
import { generateInvitation } from '@/lib/auth/invitations';

const invitation = await generateInvitation({ createdBy: user.id, note: parsed.data.note });
```

Si hay efecto secundario importante (escribir en BD, recálculo de scores, envío de notificación), **transacción** con `db.transaction()`.

### 5. Manejar errores conocidos

Errores de dominio: captura y devuelve con código.  
Errores inesperados: log + 500 genérico al cliente.

```typescript
try {
  // ...
} catch (err) {
  if (err instanceof DomainError) {
    return { error: { code: err.code, message: err.userMessage } };
  }
  logger.error('endpoint-name failed', { err, userId: user.id });
  return { error: { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal. Inténtalo de nuevo.' } };
}
```

**Nunca** devuelvas stack traces, mensajes de Postgres crudos, o nombres de columnas internas al cliente.

### 6. Respuesta tipada

Forma estándar de respuesta:

```typescript
type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; fields?: Record<string, string[]> } };
```

Exporta el tipo del resultado de cada Server Action para que el cliente lo importe.

---

## Convenciones de naming

### Server Actions

- Fichero: `app/<ruta>/actions.ts` (todas las acciones de una página juntas) o `lib/actions/<dominio>.ts` si se reutilizan entre páginas.
- Nombre de la función: verbo + objeto. `loginUser`, `generateInvitation`, `savePorraGroupMatches`.
- La primera línea del fichero: `'use server';`.

### API Routes

- Fichero: `app/api/<recurso>/route.ts`.
- Exporta `GET`, `POST`, etc. como funciones nombradas.
- Recurso en **kebab-case** plural: `/api/invitations`, `/api/matches`.

### Códigos de error

`SCREAMING_SNAKE_CASE`. Lista canónica (extender según haga falta):

- `INVALID_INPUT` — Zod ha rechazado.
- `UNAUTHENTICATED` — no hay sesión.
- `FORBIDDEN` — sesión sí, permiso no.
- `NOT_FOUND` — recurso inexistente.
- `CONFLICT` — duplicado (email ya registrado, nickname tomado).
- `LOCKED` — predicción bloqueada en el tiempo.
- `INTERNAL_ERROR` — fallo no controlado.

Los mensajes para el usuario, **siempre en español**, sin tecnicismos.

---

## Test obligatorio

Para cada endpoint, **al menos un test**:

- Server Actions críticas (auth, predicciones): test unitario de la función en `lib/` que orquesta (mockeando `getCurrentUser`).
- Flujos completos: test e2e Playwright en `tests/e2e/` que ejercita la ruta desde el navegador.

No se mergea endpoint sin test asociado.

---

## Ejemplo completo: generar invitación

```typescript
// app/admin/invitaciones/actions.ts
'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/current-user';
import { generateInvitation } from '@/lib/auth/invitations';
import { logger } from '@/lib/logger';

const inputSchema = z.object({
  note: z.string().max(80).optional(),
});

export type GenerateInvitationResult =
  | { data: { url: string }; error?: never }
  | { data?: never; error: { code: string; message: string } };

export async function generateInvitationAction(
  formData: FormData
): Promise<GenerateInvitationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };
  }
  if (!user.isAdmin) {
    return { error: { code: 'FORBIDDEN', message: 'Acceso reservado al administrador.' } };
  }

  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: {
        code: 'INVALID_INPUT',
        message: 'Datos inválidos.',
      },
    };
  }

  try {
    const invitation = await generateInvitation({
      createdBy: user.id,
      note: parsed.data.note,
    });

    return {
      data: {
        url: `${process.env.APP_URL}/registro?token=${invitation.token}`,
      },
    };
  } catch (err) {
    logger.error('generateInvitationAction failed', { err, userId: user.id });
    return {
      error: { code: 'INTERNAL_ERROR', message: 'No se ha podido generar la invitación. Inténtalo de nuevo.' },
    };
  }
}
```

---

## Anti-patterns (rechazar al revisar)

- ❌ Endpoint sin validación Zod.
- ❌ Endpoint sin check de auth (salvo lista blanca explícita).
- ❌ Lógica de negocio dentro del endpoint en lugar de `lib/`.
- ❌ `console.log` en lugar de `logger`.
- ❌ Mensajes de error en inglés o con jerga técnica al usuario final.
- ❌ Devolver stack traces, código SQL, o nombres de columnas internos al cliente.
- ❌ Manipular cookies de sesión directamente en vez de usar `lib/auth/sessions.ts`.
- ❌ Trust del cliente: aceptar `userId` en el body en lugar de tomarlo de la sesión.
- ❌ Sin test asociado.
- ❌ Server Action expuesta sin tipo de retorno explícito.
- ❌ Inconsistencia con los códigos de error canónicos (inventar códigos nuevos sin documentarlos aquí).
