# 0002 — Auth propia sin librería

**Fecha**: 2026-06-05
**Estado**: aceptada

## Contexto

Hay que elegir cómo implementar autenticación. Requisitos:
- Solo registro vía invitación (no OAuth, no signup público).
- Login con email + password.
- ≤15 usuarios.
- Plazo apretado, autor aprendiendo.

Opciones realistas: Auth.js (NextAuth), better-auth, o implementación propia con bcrypt + cookies + tabla `sessions`.

## Decisión

Auth **propia**, sin librería:

- `bcrypt` para hashing (cost factor 12).
- Tabla `sessions` en Postgres con `id` aleatorio de 32 bytes en base64url.
- Cookie `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, expiración 30 días.
- `middleware.ts` carga la sesión a partir de la cookie y la inyecta en el contexto.
- Tabla `invitations` con token de 32 bytes; consume + crea usuario en la misma transacción.

## Consecuencias

**Ganamos**:
- Cero magia. Cada paso es legible y testeable.
- Sin lock-in con librería: cuando Auth.js v6 cambie la API otra vez, no nos afecta.
- Casaba muy mal con el flujo de invitación: Auth.js está construido alrededor de providers (OAuth, magic links). Para nuestro caso obligaría a luchar contra la librería.
- Aprendemos cómo funciona auth de verdad. Bueno para el objetivo declarado.
- Menos dependencias.

**Perdemos**:
- Nada de OAuth de un click (no lo necesitamos).
- Hay que cuidar nosotros los detalles de seguridad (cookies bien marcadas, sessions revocables, rate limiting en login). El `CLAUDE.md §6` los hace explícitos.
- Si más adelante quisiéramos magic links o 2FA, hay que implementarlo a mano. Aceptado: no aplica al alcance.

## Alternativas consideradas

- **Auth.js (NextAuth)**: rechazado por fricción con el flujo invitation-only y por el track record de breaking changes entre majors.
- **better-auth**: rechazado por inmadurez (proyecto muy nuevo a fecha de decisión); revaluar en futuros proyectos.
- **Lucia**: rechazado. Está deprecado (anunciado en marzo 2025).
- **Clerk/Auth0/Kinde** (auth as a service): rechazado por coste, vendor lock-in, y contradicción con el objetivo "controlo todas las capas".

## Reglas de seguridad explícitas (heredadas en `CLAUDE.md §6`)

- bcrypt cost 12 (re-evaluar en 2 años).
- Cookie sin acceso desde JS (`httpOnly`).
- Rate limiting en `/login` (slice 8): máx 5 intentos / 15 min / IP.
- Logout invalida la sesión en BD, no solo borra la cookie.
- Tokens de invitación de un solo uso, expiran a 7 días.
- Reset de password: no existe (admin regenera invitación si alguien pierde el acceso).
