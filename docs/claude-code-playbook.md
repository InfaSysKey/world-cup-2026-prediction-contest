# Playbook de Claude Code — Porra Mundial 2026

Este documento define **cómo se usa Claude Code (v2.1.154+) con Opus 4.8, Ultracode y Dynamic Workflows** en este proyecto. Es la guía operativa: qué herramienta para qué tarea, qué skills crear, qué subagentes definir, y qué workflows guardar para reutilizar.

Objetivo: terminar el MVP en 15 días sin reventar los límites del plan ni acabar con código incoherente.

---

## 1. Modos de trabajo por tipo de tarea

La regla general: **el modo más barato que haga el trabajo bien**. Solo subimos a Ultracode cuando la tarea realmente justifica fan-out paralelo.

| Modo | Cuándo | Comando |
|---|---|---|
| `/effort medium` (default) | Edits de 1–3 archivos, refactors pequeños, fixes puntuales, conversación de diseño | (default) |
| `/effort high` | Implementar una feature completa (1 vertical slice), debugging complejo, código que toca varios módulos | `/effort high` |
| `ultracode` en un prompt suelto | Una sola tarea grande puntual sin cambiar la sesión | escribir `ultracode` en el prompt |
| `/effort ultracode` (modo auto) | Sesión dedicada a tarea grande con varios sub-objetivos (ej. scaffolding inicial, auditoría completa) | `/effort ultracode`, después `/effort high` para volver |
| Workflow guardado | Cualquiera de los 4 workflows reutilizables del proyecto (ver §5) | `/<nombre-workflow>` |

**Cómo elegir en 5 segundos**: ¿la tarea cabe en una conversación normal? → `/effort high`. ¿Necesito explorar/auditar/migrar muchos archivos en paralelo? → workflow.

---

## 2. Mapeo de los 8 slices al modo correcto

Recordatorio de los slices del plan original:

| # | Slice | Modo recomendado | Por qué |
|---|---|---|---|
| 1 | Esquema DB + seeds (48 equipos, 104 partidos) | `/effort high` | Es secuencial: schema → migraciones → seeds. Workflow no aporta |
| 2 | Auth con invitaciones | `/effort high` | Crítico, lineal, mejor un solo agente con cabeza |
| 3 | Panel admin mínimo | `/effort high` | CRUD básico |
| 4 | Formulario de porra (el grande) | `/effort high` por sub-tab, ultracode para revisión final | Cada tab es un slice. Ultracode brilla al revisar coherencia global cuando ya están todos hechos |
| 5 | Motor de puntuación | `/effort high` con TDD + subagente `scoring-auditor` al final | Algoritmo puro. Tests primero, código después, audit al final |
| 6 | Mejores terceros | **Ultracode con prompt explícito** | "Implementa la combinatoria de mejores terceros desde 3 ángulos independientes y elige el más limpio". Caso de libro para workflows |
| 7 | Clasificación y vistas | `/effort high` | UI estándar |
| 8 | Pulido + deploy producción | **Workflow `/audit-porra-pre-launch`** | Auditoría paralela de seguridad, accesibilidad, SEO, performance, tests de carga |

**Resumen**: usamos workflows solo en los slices 6 y 8, y como apoyo puntual en el 4. El resto es `/effort high` con buena disciplina.

---

## 3. Skills del proyecto

Las skills son archivos `SKILL.md` que viven en `.claude/skills/` del repo. Claude las lee automáticamente cuando detecta la tarea.

Crear estas 5 skills al principio (orden de prioridad):

### 3.1 `add-migration` (prioridad alta)

**Cuándo**: cualquier cambio de esquema de BD.

Define el formato exacto de las migraciones (Drizzle o Prisma), dónde se guardan, cómo se nombran (`NNNN_description.sql`), reglas de naming de tablas (snake_case, plural) y columnas, política de `created_at` / `updated_at`, y obligación de añadir el rollback.

### 3.2 `add-api-route` (prioridad alta)

**Cuándo**: nueva ruta en `app/api/`.

Define el esqueleto: validación con `zod` al entrar, autenticación obligatoria salvo lista blanca, manejo de errores con estructura `{ error: { code, message } }`, logging, y test e2e mínimo.

### 3.3 `add-prediction-type` (prioridad alta)

**Cuándo**: cuando ya tengas el formulario base y quieras añadir un nuevo tipo de predicción.

Define los 5 sitios que hay que tocar a la vez: migración, modelo TS, validador zod, componente del formulario, rama del motor de scoring. **Esto es lo que evita que los agentes implementen "a medias" y dejen inconsistencias**.

### 3.4 `test-scoring-rule` (prioridad media)

**Cuándo**: añadir o modificar una regla del motor de puntuación.

Define los casos canónicos que todo cambio debe pasar (marcador exacto, resultado erróneo, predicción vacía con penalización, etc.), formato del fixture, y obligación de tests antes que código.

### 3.5 `deploy-vps` (prioridad baja, para el slice 8)

**Cuándo**: cualquier cambio en `Containerfile`, `compose.yml` o el setup del VPS.

Define la rutina: build local con `podman-compose build`, smoke test contra `localhost`, push a registry, `ssh` al VPS, `podman-compose pull && up -d`, verificación de health endpoint.

---

## 4. Subagentes personalizados

Los subagentes son workers especializados que vives en `.claude/agents/`. Cada uno tiene su prompt y su allowlist de tools.

Crear 3 subagentes:

### 4.1 `scoring-auditor`

Lee `docs/scoring-rules.md` y revisa que el código del motor de puntos respeta cada regla. Tools allowlist: solo lectura de archivos + ejecutar tests. **No puede editar código**, solo señalar fallos.

Útil al final del slice 5, y cada vez que se toque scoring.

### 4.2 `migration-reviewer`

Antes de aceptar una migración nueva, revisa: que tiene rollback, que no rompe datos existentes, que respeta el naming, y que añade índices donde toca. Tools allowlist: lectura + comparación con migraciones anteriores.

### 4.3 `porra-form-tester`

Específico para el slice 4: testea el formulario rellenándolo programáticamente vía Playwright, verifica que el guardado parcial funciona, que el bloqueo temporal funciona, y que las validaciones cruzadas (ej: campeón debe estar entre los finalistas predichos) saltan.

---

## 5. Workflows guardados del proyecto

Estos cuatro son los workflows que vale la pena guardar como comando reutilizable. Los primeros se construyen pidiéndole a Claude que escriba el workflow, y cuando funcione bien lo guardas con `s` desde `/workflows`.

### 5.1 `/audit-porra-security` (para usar antes del lanzamiento)

Audita en paralelo: auth bypass, IDOR (un usuario viendo predicciones de otro antes de tiempo), SQL injection en filtros, fugas en endpoints admin, cookies sin httpOnly/secure, CORS abierto, headers de seguridad. Un subagente por categoría, todos en paralelo, informe final consolidado.

### 5.2 `/audit-porra-pre-launch` (slice 8, una sola vez)

El gordo. Workflow con 5–6 fases paralelas: seguridad, performance (Lighthouse + carga), accesibilidad (WCAG AA), SEO básico, tests de cobertura, smoke tests del flujo completo (registro → porra → admin mete resultados → puntos correctos). Genera informe final con acciones priorizadas.

### 5.3 `/full-test-suite`

Ejecuta todos los tests del proyecto en paralelo agrupados por slice. Más útil cuando el repo crezca; al principio basta con `npm test`.

### 5.4 `/explore-multiple-approaches` (puntual, para slice 6 — mejores terceros)

Workflow que implementa el algoritmo de mejores terceros desde 3 ángulos distintos (tabla hardcodeada FIFA, ordenación dinámica, búsqueda exhaustiva combinatoria), corre el mismo conjunto de tests sobre los tres, y devuelve el más limpio con justificación. Se usa una sola vez y se descarta.

---

## 6. Disciplina de coste

Workflows queman tokens. Reglas para no fundirse el plan:

1. **Antes de un workflow grande, `/usage` para ver dónde estamos**.
2. **Empezar acotado**: el primer run de `/audit-porra-security` corre solo sobre `app/api/auth/`, no sobre todo. Si funciona bien, se expande.
3. **`/model` antes de un run gordo**: si estás en Opus 4.8, evalúa si las fases de bajo riesgo (indexación, clasificación simple) pueden ir a Sonnet 4 dentro del workflow. Se le puede pedir explícitamente al diseñar el workflow.
4. **Ultracode solo en sesiones dedicadas**. Al terminar la tarea grande: `/effort high` y a otra cosa. **No dejar ultracode encendido entre tareas**.
5. **Calendario de workflows**:
   - Días 1–9: cero workflows (todo es vertical slicing normal con `/effort high`).
   - Día 10: `/explore-multiple-approaches` para mejores terceros.
   - Día 14: `/audit-porra-pre-launch` (la auditoría gorda antes del lanzamiento).
6. **Aprobar planes antes de ejecutar**: el modo `default` o `accept edits` pide aprobación cada run; el modo `auto` solo la primera vez por workflow. Para este proyecto, mantén `default` salvo en `/audit-porra-pre-launch` donde el modo `auto` ahorra ratones.

---

## 7. Setup inicial paso a paso (día 1)

```bash
# 1. Comprobar versión de Claude Code (necesita 2.1.154+)
claude --version

# 2. Si estás en Pro, activar workflows en /config
# (en Max/Team van por defecto)
claude
> /config
# → marcar "Dynamic workflows" como on

# 3. Crear estructura de claude/ en el repo
mkdir -p .claude/skills .claude/agents .claude/workflows

# 4. Crear los 5 SKILL.md y los 3 subagentes
# (irás creando cada uno justo antes de usarlo, no todos de golpe)

# 5. Verificar que Opus 4.8 es el modelo activo
> /model
# → si no, /model claude-opus-4-8

# 6. Volver a effort normal hasta que toque
> /effort high
```

---

## 8. Heurísticas para detectar errores comunes con agentes

Los workflows y subagentes meten errores plausibles pero sutiles. Lista de smell-tests para tu pase de revisión:

- **Tipos any**: si un agente mete `any` en TypeScript, casi siempre es un atajo para algo que no entendía. Bórralo y exígele el tipo correcto.
- **Tests que pasan triviales**: el agente puede escribir un test que asserta `expect(true).toBe(true)`. Lee siempre los tests, no solo el resultado verde.
- **Migraciones sin rollback**: rechaza la PR.
- **Lógica de scoring sin fixtures explícitos**: si no añade casos en `test-scoring-rule`, no se mergea.
- **Comentarios verbose que explican el "qué" en lugar del "por qué"**: borrar. El código bien escrito no necesita comentar lo que se ve.
- **Inconsistencia con `scoring-rules.md` o `data-model.md`**: rechaza y vuelve a apuntar al doc.

---

## 9. Próximas decisiones pendientes

Antes de empezar el slice 1:

1. **¿ORM o SQL puro?** Recomendación: Drizzle (ligero, TypeScript-first, bien con Postgres). Decidir antes de la skill `add-migration`.
2. **¿Validación: zod o valibot?** Recomendación: zod (más maduro, mejor ecosistema con shadcn forms).
3. **¿Sesión con cookie o JWT?** Recomendación: cookie httpOnly + session table en Postgres (más simple para 15 usuarios y revocable).
4. **¿Plan de Claude Code disponible?** Si es Pro, hay que activar workflows en `/config`. Si es Max/Team, ya están encendidos.
5. **¿Qué VPS y qué dominio?** Para el slice 8.

---

## 10. Versionado de este playbook

Este documento es **v1.0**. Si descubres que un workflow te sale mucho mejor con otro prompt, o que una skill necesita más casos, actualiza aquí y dale fecha. Es la memoria operativa del proyecto.
