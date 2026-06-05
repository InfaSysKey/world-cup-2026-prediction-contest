# 0001 — Stack técnico

**Fecha**: 2026-06-05
**Estado**: aceptada

## Contexto

Hay que elegir stack para una app web pequeña-mediana (≤15 usuarios) con:
- Auth con invitación.
- Formulario complejo de predicciones (9 categorías, ~120 inputs).
- Motor de puntuación con reglas no triviales.
- Plazo muy ajustado (15 días hasta el inicio del Mundial).
- Autor que quiere **aprender** (Claude Code + agentes), no producir mínimo viable y olvidar.
- Restricción explícita: sin sorpresas de facturación → VPS propio.

## Decisión

- **Frontend + backend**: Next.js 14 con App Router en TypeScript estricto. Server Actions para formularios.
- **Estilos**: Tailwind + shadcn/ui.
- **Base de datos**: PostgreSQL 16, en contenedor Podman.
- **ORM**: Drizzle (+ drizzle-kit para migraciones).
- **Validación**: Zod.
- **Auth**: propia (bcrypt + cookies httpOnly + tabla `sessions`). Sin Auth.js, sin Lucia.
- **Tests**: Vitest (unit) + Playwright (e2e).
- **Containers**: 3 contenedores (db, app, caddy) con podman-compose.
- **Reverse proxy**: Caddy (TLS automático).
- **Hosting**: VPS Hetzner CX22 (€4,5/mes).
- **CI**: GitHub Actions.

## Consecuencias

**Ganamos**:
- Stack moderno con TypeScript end-to-end, tipos compartidos entre cliente y servidor.
- Drizzle expone SQL real: lo que veo es lo que se ejecuta. Bueno para aprender.
- Podman da reproducibilidad: lo que corre en local corre en el VPS.
- Caddy elimina el dolor de Let's Encrypt/nginx.
- Costes predecibles: ~€5/mes total.

**Perdemos**:
- Frente a Supabase + Vercel: más setup inicial (~2 h extra en el día 1).
- Frente a Rails/Laravel: menos baterías incluidas, hay que montar más.
- TypeScript estricto + Drizzle tienen curva si vienes de WordPress/PHP.

## Alternativas consideradas

- **Supabase + Vercel + Next.js**: rechazado. La premisa era "para no tener sustos" y aprender controlando todas las capas. Supabase oculta auth y BD.
- **Rails / Laravel**: rechazado. El autor quiere aprender ecosistema TS, no Ruby/PHP.
- **Stack más simple (HTML + PHP + MySQL)**: rechazado. No aporta nada al objetivo de aprender, y el formulario complejo del slice 4 será más doloroso sin Server Actions.
- **Prisma en lugar de Drizzle**: rechazado. Prisma genera código y mete una capa de abstracción adicional; Drizzle es más transparente y compatible con edge runtimes.
