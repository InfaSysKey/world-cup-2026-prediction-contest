---
name: add-migration
description: Use this skill when adding, modifying, or removing database schema in this project. Triggers when the user mentions migrations, schema changes, adding/removing tables or columns, modifying constraints or indexes, changes to lib/db/schema.ts, or Drizzle in general.
---

# add-migration

Workflow obligatorio para **cualquier** cambio de esquema en este proyecto.

## Cuándo usar esta skill

Cualquier tarea que implique:
- Crear, modificar o borrar una tabla.
- Añadir, renombrar, cambiar tipo o eliminar una columna.
- Cambiar constraints (NOT NULL, UNIQUE, CHECK).
- Añadir o eliminar índices.
- Añadir o modificar foreign keys.
- El usuario menciona "migración", "schema", "Drizzle", "añadir tabla", "añadir columna", o edita `lib/db/schema.ts`.

## Workflow obligatorio (en orden)

### 1. Leer `docs/data-model.md` PRIMERO

`docs/data-model.md` es el source of truth de la intención. Si el cambio no está reflejado ahí, **se actualiza primero ese documento**. Sin excepción.

### 2. Editar `lib/db/schema.ts`

Reflejar el cambio en Drizzle. Usar los tipos del helper `@/lib/db/schema-types` cuando existan.

### 3. Generar la migración

```bash
npx drizzle-kit generate
```

Esto crea un archivo nuevo en `lib/db/migrations/`.

### 4. Revisar el SQL generado a mano

Confirmar:
- [ ] Los nombres siguen las convenciones (ver §Naming).
- [ ] Hay índices donde tocan (ver §Índices).
- [ ] Las FKs tienen `ON DELETE` explícito (ver §FKs).
- [ ] No hay drops involuntarios.
- [ ] Los `timestamptz` son `timestamptz`, no `timestamp` a secas.

### 5. Añadir bloque ROLLBACK

**Toda migración tiene un bloque de rollback al final**, como SQL comentado. Sin esto, la PR se rechaza.

```sql
-- ROLLBACK
-- DROP TABLE IF EXISTS nueva_tabla;
-- ALTER TABLE tabla_existente DROP COLUMN nueva_columna;
```

### 6. Renombrar el archivo si hace falta

Formato: `NNNN_verbo_objeto.sql`. Número siguiente disponible, lowercase, snake_case, verbo + objeto descriptivo.

Ejemplos válidos:
- `0001_create_users.sql`
- `0002_create_sessions_and_invitations.sql`
- `0003_create_teams_and_matches.sql`
- `0004_add_predictions_tables.sql`
- `0005_add_index_scores_user_category.sql`

### 7. Probar en local sobre BD limpia

```bash
# Tumbar y recrear el contenedor de DB para empezar limpio
cd infra && podman-compose down db && podman volume rm porra-db-data
podman-compose up -d db

# Aplicar TODAS las migraciones desde cero
npm run db:migrate

# Seed si aplica
npm run db:seed

# Verificar con psql
psql postgres://porra:porra@localhost:5432/porra
```

Dentro de psql, mínimo:
```sql
\dt             -- listar tablas
\d nueva_tabla  -- inspeccionar estructura
```

### 8. Actualizar `docs/data-model.md` si quedó desincronizado

Si el doc no estaba ya al día tras el paso 1, sincronizarlo ahora con el SQL final.

---

## Naming

Heredado de `CLAUDE.md §4.2`:

- **Tablas**: `snake_case` plural. `users`, `predictions_group_matches`.
- **Columnas**: `snake_case`. `created_at`, `goles_local`, `home_team_code`.
- **Índices**: `idx_<tabla>_<columnas>`. Ej.: `idx_sessions_user_id`, `idx_matches_scheduled_at`.
- **Constraints UNIQUE compuestos**: `uq_<tabla>_<columnas>`. Ej.: `uq_predictions_user_match`.
- **CHECK constraints**: `chk_<tabla>_<descripcion>`. Ej.: `chk_matches_score_non_negative`.

Drizzle nombra automáticamente las FKs; aceptar el default.

---

## Columnas obligatorias

Toda tabla, salvo excepciones documentadas en `data-model.md`:

- `id` como primary key.
  - `bigserial` para tablas de alto volumen (`scores`, `predictions_*`).
  - `smallserial` o `smallint` con `id` natural para tablas pequeñas fijas (`matches.id` 1-104).
  - `text` para claves naturales (`teams.code = 'ESP'`).
- `created_at timestamptz NOT NULL DEFAULT now()`.
- `updated_at timestamptz NOT NULL DEFAULT now()` con `.$onUpdate(() => new Date())` en Drizzle, **si la fila se modifica tras crearse**.

Excepciones aceptadas (ya en `data-model.md`):
- `sessions`: sin `updated_at` (solo `expires_at`).
- `teams`: sin `updated_at` (catálogo inmutable).

---

## Política de índices

Añadir índice cuando:
- La columna se usa en `WHERE` filtrando >5% de filas.
- La columna participa en `JOIN` (FKs típicamente).
- La columna se usa en `ORDER BY` sobre datasets >1000 filas.

NO añadir índices "por si acaso". Cada índice ralentiza writes.

Para columnas con muchos null (ej. `invitations.used_by`), considerar **índice parcial**:
```sql
CREATE INDEX idx_invitations_active ON invitations(expires_at) WHERE used_by IS NULL;
```

---

## Política de foreign keys

Toda FK con `ON DELETE` explícito. Sin defaults implícitos.

| Caso | Acción | Ejemplo |
|---|---|---|
| Filas hijas sin sentido sin padre | `CASCADE` | `sessions.user_id` → `users.id` |
| Borrar padre rompería auditoría | `RESTRICT` | `invitations.created_by` → `users.id` |
| Relación opcional, mantener histórico | `SET NULL` | `invitations.used_by` → `users.id` |

---

## Ejemplo: añadir una tabla nueva

Usuario: "Necesito una tabla de notificaciones por usuario".

**Paso 1** — Actualizar `docs/data-model.md` con la nueva tabla.

**Paso 2** — Editar `lib/db/schema.ts`:

```typescript
import { pgTable, bigserial, bigint, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_notifications_user_id').on(table.userId),
}));
```

**Paso 3** — `npx drizzle-kit generate`.

**Paso 4** — Revisar el SQL. Añadir al final:

```sql
-- ROLLBACK
-- DROP TABLE IF EXISTS notifications;
```

**Paso 5** — Test local con BD limpia.

---

## Anti-patterns (rechazar inmediatamente)

Una migración con cualquiera de estos se devuelve sin mergear:

- ❌ Sin bloque ROLLBACK.
- ❌ DROP de columna o tabla sin plan de backup/export.
- ❌ CASCADE sobre tabla con datos valiosos sin justificación explícita.
- ❌ RENAME de columna sin paso intermedio (add new + copy + drop old).
- ❌ `varchar(N)` sin razón real (usar `text`).
- ❌ Tipo `enum` de Postgres (usar `text` + check constraint o constantes TS).
- ❌ `timestamp` sin timezone (usar `timestamptz` siempre).
- ❌ Default `now()` en columnas no temporales.
- ❌ Migración que combina varios cambios no relacionados (separar en migraciones distintas).
- ❌ Editar una migración ya aplicada en otro entorno (se crea una nueva que rectifica).
