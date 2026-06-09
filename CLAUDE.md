# CLAUDE.md — Porra Mundial 2026

> Este archivo lo lee Claude Code automáticamente al abrir el repo. Es la **constitución del proyecto**: convenciones, stack, estructura, qué hacer y qué no. Si una instrucción aquí choca con un prompt suelto del humano, **manda lo de aquí** salvo que el humano lo invalide explícitamente.

---

## 1. Qué es este proyecto

Aplicación web para gestionar una **porra del Mundial 2026** entre un grupo cerrado de hasta 15 amigos. Acceso por invitación (token generado por el admin), una porra por usuario, predicciones bloqueadas al pitido inicial del primer partido (11 jun 2026, 19:00 hora España), clasificación y puntos automáticos al introducir resultados oficiales.

**Documentos de referencia obligatorios** (léelos antes de tocar nada que afecte a su área):

- `docs/scoring-rules.md` — todas las reglas de puntuación. Cualquier cambio en el motor de scoring tiene que respetarlas.
- `docs/data-model.md` — esquema completo de la base de datos. Cualquier migración pasa primero por aquí.
- `docs/claude-code-playbook.md` — cómo se usan ultracode, workflows, skills y subagentes en este proyecto.

---

## 2. Stack técnico

| Capa | Elección | Versión mínima |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Framework | Next.js (App Router) | 14 |
| Lenguaje | TypeScript en modo `strict` | 5.4+ |
| Estilos | Tailwind CSS + `shadcn/ui` | última estable |
| Base de datos | PostgreSQL | 16 |
| ORM / migraciones | Drizzle + `drizzle-kit` | última |
| Validación de input | Zod | última |
| Hashing de contraseñas | `bcrypt` (cost factor 12) | última |
| Auth | Propia: cookie `httpOnly` + tabla `sessions` (NO Auth.js, NO Lucia) | — |
| Testing unitario | Vitest | última |
| Testing e2e | Playwright | última |
| Containerización | Podman + podman-compose | 4.x+ |
| Reverse proxy | Caddy (TLS automático) | 2.x |
| CI | GitHub Actions | — |

**No introducir dependencias adicionales sin justificar.** Cada paquete nuevo añade superficie de mantenimiento. Si una funcionalidad cabe en 30 líneas de TypeScript, no se instala una librería.

---

## 3. Estructura del repositorio

```
.
├── .claude/
│   ├── skills/             # SKILL.md por área (ver §11)
│   ├── agents/             # subagentes personalizados (ver playbook §4)
│   └── workflows/          # workflows guardados (ver playbook §5)
├── docs/
│   ├── scoring-rules.md
│   ├── data-model.md
│   ├── claude-code-playbook.md
│   ├── getting-started.md
│   └── decisions/          # ADRs (Architecture Decision Records)
├── app/                    # Next.js App Router
│   ├── (auth)/             # rutas públicas: /login, /registro
│   ├── (porra)/            # rutas autenticadas: /porra, /clasificacion, /perfil
│   ├── admin/              # rutas admin (middleware exige is_admin)
│   └── api/                # endpoints REST si hacen falta (preferir Server Actions)
├── components/
│   ├── ui/                 # shadcn (no editar a mano, solo via CLI)
│   └── porra/              # componentes del dominio
├── lib/
│   ├── db/
│   │   ├── schema.ts       # source of truth del esquema
│   │   ├── migrations/     # generadas por drizzle-kit
│   │   ├── seed.ts         # 48 equipos + 104 partidos del Mundial
│   │   └── index.ts        # cliente drizzle
│   ├── auth/               # session, password hashing, invitations
│   ├── scoring/            # motor de puntos (puro, testeable)
│   ├── validators/         # esquemas zod compartidos
│   └── constants.ts        # nada de magic strings/numbers
├── tests/
│   ├── e2e/                # tests Playwright
│   └── fixtures/           # helpers y datos compartidos por los tests e2e
├── infra/
│   ├── Containerfile       # imagen de la app
│   ├── compose.yml         # db + app + caddy
│   ├── Caddyfile
│   └── scripts/            # backup, restore, deploy
├── .env.example            # plantilla con todas las variables
├── .gitignore
├── CLAUDE.md               # ESTE archivo
├── README.md
├── package.json
└── tsconfig.json
```

**Tests viven junto al código**: `foo.ts` y `foo.test.ts` en la misma carpeta. Excepción: e2e en `tests/e2e/`.

---

## 4. Convenciones de código

### 4.1 TypeScript

- `strict: true` en `tsconfig.json`. Sin excepciones.
- **Prohibido `any`**. Si no sabes el tipo, usa `unknown` y haz narrowing. `any` en un PR es razón directa de rechazo.
- Prohibido `as` salvo en validación tras `zod.parse()` (donde ya está garantizado).
- Prefiere `type` sobre `interface` salvo que necesites extender desde una clase o usar declaration merging.
- Nombres de tipos en `PascalCase`, sin prefijo `I` ni `T`.
- Enums: NO. Usa `as const` + `type` derivado.

### 4.2 Nombres

| Cosa | Convención | Ejemplo |
|---|---|---|
| Archivos TS/TSX | `kebab-case.ts` | `scoring-engine.ts` |
| Componentes React | `PascalCase` en código, archivo `kebab-case` | `<PorraForm />` en `porra-form.tsx` |
| Funciones / variables | `camelCase` | `calculateUserScore` |
| Constantes globales | `SCREAMING_SNAKE_CASE` | `MAX_PREDICTIONS_PER_USER` |
| Tablas Postgres | `snake_case` plural | `users`, `group_predictions` |
| Columnas Postgres | `snake_case` | `created_at`, `goles_local` |
| Rutas API | `kebab-case` | `/api/invitations/generate` |

### 4.3 Estilo de código

- Imports absolutos vía alias `@/` (configurado en `tsconfig.json`).
- Orden de imports: librerías externas → `@/` internas → relativos → tipos.
- Funciones de utilidad sin estado en `lib/`. Sin estado, sin side effects, fáciles de testear.
- Componentes React: server components por defecto. `'use client'` solo cuando hace falta (hooks, event handlers, browser APIs).
- Preferir **Server Actions** para formularios. Endpoints `/api/` solo si los necesita un cliente no-Next.
- Sin `console.log` en código mergeado. Usa el logger de `lib/logger.ts` (crear en slice 2).

### 4.4 Errores

- Forma estándar de error de API: `{ error: { code: 'INVALID_TOKEN', message: 'El token de invitación ha caducado.' } }`.
- Códigos de error en `SCREAMING_SNAKE_CASE`.
- Mensajes en **español**, dirigidos al usuario final, sin tecnicismos.
- Errores internos (no mostrables): logger + 500 genérico al cliente.

### 4.5 Comentarios

- Comentarios explican **el porqué**, no el qué. Si necesitas comentar lo que hace una línea, renombra variables o extrae función.
- Cabeceras de fichero: no. El nombre del archivo y su contenido bastan.
- TODOs solo con issue asociado: `// TODO(#42): ...`.

---

## 5. Base de datos

- **Source of truth**: `lib/db/schema.ts`. Toda la realidad sale de ahí.
- Migraciones generadas con `drizzle-kit generate`. Nunca editar SQL a mano salvo rollback.
- Cada migración con su rollback en el mismo archivo (sección comentada `-- ROLLBACK`).
- Naming de migración: `NNNN_verbo_objeto.sql` (ej. `0003_add_predictions_table.sql`).
- Índices: añadir explícitamente cuando una columna se consulte por filtro o join. No "por si acaso".
- Foreign keys: siempre con `ON DELETE` declarado (`CASCADE`, `RESTRICT` o `SET NULL`).
- `created_at` y `updated_at` (`timestamptz`) en todas las tablas excepto `sessions` (que solo necesita `expires_at`).
- Para detalles ver `docs/data-model.md` (a redactar en slice 1).

---

## 6. Autenticación y autorización

- Sin librería externa. Implementación propia:
  - Tabla `users` con `password_hash` (bcrypt cost 12).
  - Tabla `sessions` (`id`, `user_id`, `expires_at`, `created_at`).
  - Cookie de sesión: nombre `porra_session`, `httpOnly`, `secure`, `sameSite=lax`, `path=/`, expiración 30 días.
  - Middleware en `middleware.ts` que carga sesión y la inyecta en el contexto.
- **Registro solo vía invitación**. Tabla `invitations` con `token`, `created_by`, `used_by`, `expires_at`. Tokens de 32 bytes con `crypto.randomBytes`, base64url. Caducidad 7 días.
- Admin = `users.is_admin = true`. Middleware `requireAdmin` para `/admin/**` y endpoints sensibles.
- **No exponer hashes ni tokens en respuestas, ni siquiera al propio usuario**. Cuando se genera una invitación se devuelve la URL completa una vez, después solo el id.

---

## 7. Validación de input

- **Todo input externo pasa por Zod**. Sin excepciones.
- Esquemas reutilizables en `lib/validators/`.
- Server Actions: el `FormData` se parsea con `zod.parse()` al inicio. Si falla, vuelve con errores al formulario.
- API routes: validar `body`, `query` y `params` por separado.
- No confiar nunca en el tipo derivado del cliente. Validar en el servidor.

---

## 8. Testing

- **TDD ligero**: tests primero en el motor de scoring (`lib/scoring/`), en validadores, y en la lógica de mejores terceros. En UI y CRUD, tests después.
- Unitarios con Vitest. Vivir junto al código.
- E2E con Playwright. Cubren los 4 flujos críticos: registro con invitación, rellenar porra completa, admin mete resultado, ver clasificación actualizada.
- Antes de mergear un slice: `npm test` y `npm run e2e` deben pasar.
- Sin tests triviales tipo `expect(true).toBe(true)`. Si no tienes nada que assertar, no escribas el test.

---

## 9. Git y PRs

- **Una rama por slice**: `slice-N-descripcion-corta`. Ejemplo: `slice-2-auth-invitaciones`.
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `infra:`. Mensaje en español.
- **PR aunque seas solo tú**. Disciplina mental: el diff te obliga a releerlo.
- Squash merge a `main`. Mensaje final del PR como commit.
- Tag al final de cada slice: `slice-N-done`.

---

## 10. Lo que NO se hace

Lista negra explícita. Si encuentras código que viola esto, lo señalas o lo arreglas:

1. ❌ `any` en TypeScript.
2. ❌ `console.log` en código mergeado.
3. ❌ Magic strings o números repetidos. Van a `lib/constants.ts`.
4. ❌ Lógica de negocio en componentes React. Va a `lib/`.
5. ❌ Modificar archivos en `components/ui/` a mano (son de shadcn).
6. ❌ Migraciones sin rollback.
7. ❌ Endpoints sin validación de input.
8. ❌ Endpoints sin auth salvo lista blanca explícita (login, registro con token).
9. ❌ Mostrar mensajes de error técnicos al usuario final (stack traces, "PG error 23505", etc.).
10. ❌ Modificar `docs/scoring-rules.md` sin abrir un ADR en `docs/decisions/` y planificar recálculo.
11. ❌ Hardcodear secrets. Todo en `.env`, plantilla en `.env.example`.
12. ❌ Commits directos a `main`.
13. ❌ Saltar tests porque "es trivial".
14. ❌ Dejar `/effort ultracode` activo entre sesiones (ver playbook §6).

---

## 11. Skills del proyecto

Las skills viven en `.claude/skills/<nombre>/SKILL.md` y se cargan automáticamente cuando Claude detecta la tarea. Listado y prioridad en `docs/claude-code-playbook.md` §3.

Crear cada skill **justo antes** del slice que la necesita, no todas de golpe. Esto fuerza a que cada skill nazca de un problema real.

---

## 12. Decisiones arquitectónicas (ADRs)

Cuando tomemos una decisión que no es obvia y querríamos justificar dentro de 6 meses, va a `docs/decisions/NNNN-titulo.md` con este formato corto:

```markdown
# NNNN — Título de la decisión

**Fecha**: YYYY-MM-DD
**Estado**: aceptada | revertida | superada por NNNN

## Contexto
Qué problema teníamos.

## Decisión
Qué decidimos hacer.

## Consecuencias
Qué ganamos y qué perdimos.

## Alternativas consideradas
Qué descartamos y por qué.
```

ADRs ya planificados:

- `0001-stack-tecnico.md` — por qué Next + Drizzle + Postgres + Podman.
- `0002-auth-propia-sin-libreria.md` — por qué no Auth.js.
- `0003-bracket-rigido-sin-rebracket.md` — por qué la predicción del bracket no se recoloca.

---

## 13. Variables de entorno

`.env.example` se mantiene siempre al día. Variables actuales:

```
# App
NODE_ENV=development|production
APP_URL=http://localhost:3000
COOKIE_SECRET=...   # 32 bytes random, base64

# Database
DATABASE_URL=postgres://porra:porra@localhost:5432/porra

# Bootstrap
ADMIN_BOOTSTRAP_EMAIL=...    # solo se usa una vez para crear el admin inicial
ADMIN_BOOTSTRAP_PASSWORD=... # idem, borrar tras primer arranque

# Mundial 2026
TOURNAMENT_START_AT=2026-06-11T17:00:00Z  # cierre global de predicciones (MVP)
```

`.env` está en `.gitignore`. **Nunca commitear secrets**.

---

## 14. Cómo correr el proyecto en local

```bash
# 1. Levantar Postgres + Caddy con podman-compose
cd infra && podman-compose up -d db

# 2. Aplicar migraciones
npm run db:migrate

# 3. Sembrar datos del Mundial
npm run db:seed

# 4. Arrancar la app
npm run dev

# 5. (Una sola vez) crear el admin
npm run admin:bootstrap
```

Detalle completo en `docs/getting-started.md`.

---

## 15. Despliegue

Pipeline mínimo:

1. `git push origin slice-N-descripcion` → CI corre tests + build.
2. Merge PR a `main` → GitHub Actions builda imagen y la pushea a `ghcr.io/<owner>/porra-app:<sha>`.
3. SSH al VPS → `cd /opt/porra && ./scripts/deploy.sh <sha>`.
4. Health check en `/api/health` antes de quitar el contenedor viejo.

Backups: `pg_dump` nocturno por cron, retención 30 días local + 90 días Backblaze B2.

---

## 16. Cuándo y cómo escalar las reglas

Este documento es **v1.0**. Cada cambio significativo bumpea versión y se anota al final con fecha + diff. Si te encuentras peleándote con una regla porque ya no aplica, no la rompas: **propone cambio aquí primero**, justificándolo.
