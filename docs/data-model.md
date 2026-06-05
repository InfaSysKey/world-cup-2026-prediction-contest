# data-model.md — Porra Mundial 2026

> Esquema completo de la base de datos. **Source of truth en código**: `lib/db/schema.ts` (Drizzle). Este documento explica la intención y las decisiones; el código manda en caso de discrepancia.

---

## 1. Visión general

12 tablas, agrupadas en 4 zonas:

| Zona | Tablas | Quién escribe |
|---|---|---|
| **Identidad** | `users`, `sessions`, `invitations` | App (registro, login) |
| **Catálogo del torneo** | `teams`, `matches` | Seed inicial; admin actualiza marcadores |
| **Predicciones del usuario** | `predictions_group_matches`, `predictions_group_standings`, `predictions_best_thirds`, `predictions_knockout`, `predictions_awards` | Usuario (formulario) |
| **Resultados oficiales y puntuación** | `actual_group_standings`, `actual_best_thirds`, `actual_awards`, `scores` | Admin + motor de scoring |

**Convenciones globales**:
- Todas las tablas tienen `created_at timestamptz NOT NULL DEFAULT now()`. Las que se modifican post-creación añaden `updated_at` con trigger o `$onUpdate` de Drizzle.
- PKs: `id` autonuméricas (`serial`/`bigserial`) salvo donde un código natural sea claramente mejor (ej. `teams.code = 'ESP'`).
- FKs: siempre con `ON DELETE` explícito.
- Booleanos por defecto `false`.
- Texto sin límite arbitrario (Postgres no penaliza `text` vs `varchar(N)`).
- Importes monetarios o decimales: NO aplica aquí.
- Timestamps siempre `timestamptz`. Nunca `timestamp` a secas.

---

## 2. Zona Identidad

### 2.1 `users`

Usuarios de la porra. Registro solo vía invitación.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `email` | `text` UNIQUE | no | — | Normalizado a minúsculas en la app |
| `password_hash` | `text` | no | — | bcrypt cost 12 |
| `nombre` | `text` | no | — | |
| `apellidos` | `text` | no | — | |
| `nickname` | `text` UNIQUE | no | — | 3–20 chars, regex `^[a-zA-Z0-9_-]+$` |
| `is_admin` | `boolean` | no | `false` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Índices**: UNIQUE en `email`, UNIQUE en `nickname` (case-insensitive — usar `CITEXT` o normalizar en código).

**Reglas de borrado**: NO se borran usuarios mientras dure el torneo. Si hay que expulsar a alguien, `is_active = false` (campo a añadir si surge el caso).

---

### 2.2 `sessions`

Sesiones de login activas. Una fila = una cookie viva.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `text` PK | no | — | 32 bytes random base64url generados en app |
| `user_id` | `bigint` FK → `users.id` ON DELETE CASCADE | no | — | |
| `expires_at` | `timestamptz` | no | — | now() + 30 días |
| `created_at` | `timestamptz` | no | `now()` | |

**Índices**: `user_id` (para "cerrar todas mis sesiones"), `expires_at` (para purga periódica).

**Limpieza**: cron o job al inicio del proceso que borre `WHERE expires_at < now()`.

---

### 2.3 `invitations`

Tokens de invitación que el admin genera.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `token` | `text` UNIQUE | no | — | 32 bytes random base64url |
| `created_by` | `bigint` FK → `users.id` ON DELETE RESTRICT | no | — | Admin que la generó |
| `used_by` | `bigint` FK → `users.id` ON DELETE SET NULL | sí | `null` | Usuario que la consumió |
| `used_at` | `timestamptz` | sí | `null` | |
| `expires_at` | `timestamptz` | no | — | Default en código: now() + 7 días |
| `note` | `text` | sí | `null` | Etiqueta libre ("Para Juan", "Para mi hermano") |
| `created_at` | `timestamptz` | no | `now()` | |

**Reglas**:
- Una invitación se considera **usable** si `used_by IS NULL AND expires_at > now()`.
- Al consumir, dentro de la misma transacción: insertar `user`, set `used_by` y `used_at`.

**Índices**: UNIQUE en `token`, índice parcial en `(expires_at) WHERE used_by IS NULL`.

---

## 3. Zona Catálogo del torneo

### 3.1 `teams`

Las 48 selecciones del Mundial. Se siembra una vez, no se modifica.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `code` | `text` PK | no | — | ISO-3166 alpha-3 (`ESP`, `MEX`...). 3 chars |
| `name_es` | `text` | no | — | Nombre en español (`España`, `Países Bajos`) |
| `flag_emoji` | `text` | no | — | `🇪🇸`, `🇲🇽`, `🏴󠁧󠁢󠁥󠁮󠁧󠁿`... |
| `group_letter` | `text` | no | — | `A` a `L`. Char(1). |

**Índices**: PK natural sobre `code`. Índice secundario en `group_letter`.

**Notas**: Inglaterra y Escocia usan flags compuestas; mantener el string Unicode completo. Validar visualmente en seed.

---

### 3.2 `matches`

Los 104 partidos del torneo. Se siembra con calendario y referencias de bracket; admin actualiza resultados.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `smallint` PK | no | — | 1–104, fijo del seed (mismo del Excel) |
| `phase` | `text` | no | — | `grupos` \| `1/16` \| `1/8` \| `cuartos` \| `semi` \| `3-4` \| `final` |
| `group_letter` | `text` | sí | `null` | Solo si `phase='grupos'` |
| `jornada` | `text` | sí | `null` | `J1` \| `J2` \| `J3`, solo si `phase='grupos'` |
| `bracket_slot` | `text` | sí | `null` | Identificador del slot ganador: `W73`...`W104` |
| `scheduled_at` | `timestamptz` | no | — | Fecha y hora oficiales |
| `home_team_code` | `text` FK → `teams.code` | sí | `null` | Nullable para slots no resueltos |
| `away_team_code` | `text` FK → `teams.code` | sí | `null` | |
| `home_slot_ref` | `text` | sí | `null` | Ref simbólica si team no conocido: `2A`, `1E`, `W73`, `3ABCDF` |
| `away_slot_ref` | `text` | sí | `null` | |
| `real_goles_local` | `smallint` | sí | `null` | Resultado en tiempo reglamentario para grupos; resultado final (con prórroga/penaltis) para knockouts |
| `real_goles_visitante` | `smallint` | sí | `null` | |
| `real_winner_team_code` | `text` FK → `teams.code` | sí | `null` | Solo se usa en knockouts (en grupos el empate vale) |
| `status` | `text` | no | `'scheduled'` | `scheduled` \| `live` \| `finished` \| `cancelled` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Índices**: `phase`, `group_letter`, `scheduled_at`, `bracket_slot`.

**Reglas**:
- Cuando `phase='grupos'`, `home_team_code` y `away_team_code` se siembran ya. `home_slot_ref`/`away_slot_ref` se quedan null.
- Cuando `phase != 'grupos'`, al sembrar se ponen los `slot_ref`. El admin (o un job) rellena los `team_code` reales cuando se resuelven las rondas anteriores.
- `real_winner_team_code` se calcula automáticamente para grupos (puede ser null si hay empate, lo cual es válido). Para knockouts el admin lo introduce explícitamente porque puede venir de penaltis.

---

## 4. Zona Predicciones del usuario

Cinco tablas, una por categoría predecible. Todas tienen `user_id FK → users.id ON DELETE CASCADE` (si borras un usuario en pruebas, se llevan sus predicciones por delante).

Todas tienen `created_at` y `updated_at` para auditoría.

**Regla crucial: cada predicción está "bloqueada" o "abierta"**. El bloqueo no es una columna en la tabla, sino una **función calculada en código** comparando `now()` con el bloqueo correspondiente (ver `scoring-rules.md §5`). El backend rechaza writes si la predicción está bloqueada.

### 4.1 `predictions_group_matches`

Marcador exacto de cada partido de fase de grupos.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `match_id` | `smallint` FK → `matches.id` | no | — | Solo `phase='grupos'` |
| `goles_local` | `smallint` | no | — | 0–20, validación en zod |
| `goles_visitante` | `smallint` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

**Constraint UNIQUE** `(user_id, match_id)`.

### 4.2 `predictions_group_standings`

Orden 1–4 que el usuario predice en cada grupo.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `group_letter` | `text` | no | — | `A` a `L` |
| `position` | `smallint` | no | — | 1–4 |
| `team_code` | `text` FK → `teams.code` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

**Constraints**:
- UNIQUE `(user_id, group_letter, position)`
- UNIQUE `(user_id, group_letter, team_code)` (no puedes poner el mismo equipo en dos posiciones)
- CHECK: `team_code` debe pertenecer al grupo `group_letter` (mejor validar en app — Postgres no puede hacer joins en CHECK)

### 4.3 `predictions_best_thirds`

Los 8 mejores terceros que el usuario predice que clasifican.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `position` | `smallint` | no | — | 1–8 |
| `team_code` | `text` FK → `teams.code` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

**Constraints**: UNIQUE `(user_id, position)`, UNIQUE `(user_id, team_code)`. Validación en app: el team debe estar en 3ª posición en la predicción de standings del mismo usuario (coherencia).

### 4.4 `predictions_knockout`

Ganadores que el usuario predice para cada cruce eliminatorio.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `match_id` | `smallint` FK → `matches.id` | no | — | Solo `phase != 'grupos'` |
| `winner_team_code` | `text` FK → `teams.code` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

**Constraint UNIQUE** `(user_id, match_id)`.

**Notas**: cubre 1/16 (16 cruces) + 1/8 (8) + cuartos (4) + semis (2) + 3-4 (1) + final (1) = 32 filas por usuario. Campeón = ganador del partido `phase='final'`. 3.º = ganador del partido `phase='3-4'`.

### 4.5 `predictions_awards`

Premios individuales y podio explícito (redundante con knockout pero más simple de puntuar).

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `kind` | `text` | no | — | Enum-as-const (ver abajo) |
| `team_code` | `text` FK → `teams.code` | sí | `null` | Para `champion`, `runner_up`, `third` |
| `player_name` | `text` | sí | `null` | Para `boot_gold`, `boot_silver`, `boot_bronze`, `ball_gold`, `ball_silver`, `ball_bronze` |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

**Valores válidos de `kind`**: `champion`, `runner_up`, `third`, `boot_gold`, `boot_silver`, `boot_bronze`, `ball_gold`, `ball_silver`, `ball_bronze`. **9 filas por usuario**.

**Constraint UNIQUE** `(user_id, kind)`.

**Validación en app**: si `kind` en (champion, runner_up, third), `team_code` debe estar; si es un boot/ball, `player_name` debe estar y el otro `null`.

---

## 5. Zona Resultados oficiales y puntuación

Lo que el admin introduce y el motor de scoring computa.

### 5.1 `actual_group_standings`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `group_letter` | `text` PK | no | — | A–L |
| `position` | `smallint` PK | no | — | 1–4 |
| `team_code` | `text` FK → `teams.code` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

PK compuesta `(group_letter, position)`.

### 5.2 `actual_best_thirds`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `position` | `smallint` PK | no | — | 1–8 |
| `team_code` | `text` FK → `teams.code` | no | — | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

### 5.3 `actual_awards`

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `kind` | `text` PK | no | — | Mismo enum que predictions_awards |
| `team_code` | `text` FK → `teams.code` | sí | `null` | |
| `player_name` | `text` | sí | `null` | |
| `created_at` / `updated_at` | `timestamptz` | no | `now()` | |

### 5.4 `scores`

Desglose de puntos por usuario y categoría. Una fila por usuario y categoría. Recalculado cada vez que el admin toca un resultado.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `user_id` | `bigint` FK | no | — | |
| `category` | `text` | no | — | Enum: `group_matches`, `group_standings`, `best_thirds`, `bracket`, `podium`, `awards`, `penalties` |
| `points` | `integer` | no | `0` | Puede ser negativo (penalties) |
| `detail` | `jsonb` | no | `'{}'` | Estructura por categoría con desglose detallado (qué aciertos contribuyeron) |
| `calculated_at` | `timestamptz` | no | `now()` | |

**Constraint UNIQUE** `(user_id, category)`.

**Total por usuario**: `SUM(points)`. Se cachea como vista materializada o se computa con `GROUP BY` (con 15 usuarios sobra cualquiera).

### 5.5 `score_recalculations` (auditoría)

Cada vez que el motor recalcula tras un cambio del admin, deja huella.

| Columna | Tipo | Nullable | Default | Notas |
|---|---|---|---|---|
| `id` | `bigserial` PK | no | — | |
| `triggered_by` | `bigint` FK → `users.id` | no | — | Admin |
| `reason` | `text` | no | — | Mensaje libre del admin |
| `affected_categories` | `text[]` | no | — | Qué categorías se recalcularon |
| `users_affected` | `integer` | no | — | Cuántas filas de `scores` cambiaron |
| `created_at` | `timestamptz` | no | `now()` | |

---

## 6. Vistas / consultas frecuentes

### 6.1 Ranking general

```sql
SELECT
  u.id, u.nickname,
  COALESCE(SUM(s.points), 0) AS total,
  SUM(CASE WHEN s.category='group_matches' THEN s.points ELSE 0 END) AS pts_grupos,
  SUM(CASE WHEN s.category='bracket' THEN s.points ELSE 0 END) AS pts_bracket,
  SUM(CASE WHEN s.category='podium' THEN s.points ELSE 0 END) AS pts_podio
FROM users u
LEFT JOIN scores s ON s.user_id = u.id
WHERE u.is_admin = false
GROUP BY u.id, u.nickname
ORDER BY total DESC;
```

### 6.2 Predicciones de un usuario para un grupo

Join `predictions_group_matches` con `matches` filtrando por `group_letter`.

### 6.3 ¿Está bloqueada esta predicción?

Función pura en `lib/scoring/locks.ts`:
- `isGroupMatchPredictionLocked(matchId)`: compara `now()` con `matches.scheduled_at` (o con `TOURNAMENT_START_AT` si MVP global lock).
- `isGroupStandingsLocked(groupLetter)`: con la fecha del último partido del grupo.
- ...y así.

---

## 7. Convenciones de Drizzle

- `schema.ts` exporta cada tabla como constante (`export const users = pgTable(...)`).
- Tipos inferidos: `type User = typeof users.$inferSelect` para reads, `type NewUser = typeof users.$inferInsert` para inserts.
- Relations declaradas con `relations(table, ({ one, many }) => ...)` para joins tipados.
- Enums representados como `text` + constantes TS exportadas + zod schemas para validación:

```typescript
// lib/db/schema.ts
export const PHASES = ['grupos', '1/16', '1/8', 'cuartos', 'semi', '3-4', 'final'] as const;
export type Phase = typeof PHASES[number];

// lib/validators/match.ts
export const phaseSchema = z.enum(PHASES);
```

---

## 8. Seed inicial obligatorio

Tras `npm run db:migrate`, ejecutar `npm run db:seed` que inserta:

1. **48 equipos** en `teams`. Lista canónica en `lib/db/seed/teams.ts`.
2. **72 partidos de fase de grupos** en `matches` con fechas oficiales FIFA, codes de equipos resueltos.
3. **32 partidos de eliminatorias** en `matches` con `slot_ref` poblado y `team_code` null.
4. **1 usuario admin bootstrap** (a partir de `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`). El seed pone `is_admin=true`.

El seed debe ser **idempotente**: si ya hay equipos, no duplica. Útil para entornos de test.

---

## 9. Mapeo de mejores terceros (lógica, no tabla)

Vive en código (`lib/scoring/best-thirds-mapping.ts`), no en BD. Hashmap derivado del Excel:

```typescript
// Dado el set de grupos que sí dan tercer clasificado (8 de los 12),
// devuelve qué tercer clasificado va a qué match (1/16).
// Hay C(12,8) = 495 combinaciones; almacenamos la tabla completa.
export const BEST_THIRDS_MAPPING: Record<string, Record<string, string>> = {
  "ABCDEFGH": { /* match 74: tercero de... */ ... },
  "ABCDEFGI": { ... },
  // ... 495 entradas
};
```

Esto se genera scripteando la `Combinaciones` del Excel original. Tarea del slice 1.

---

## 10. Versionado

Este documento es **v1.0**. Cualquier cambio de tabla, columna o constraint genera:

1. Bump de versión (`v1.1`, etc.).
2. Nueva migración Drizzle.
3. Entrada en `score_recalculations` si afecta a puntos.
4. ADR en `docs/decisions/` si el cambio es estructural.
