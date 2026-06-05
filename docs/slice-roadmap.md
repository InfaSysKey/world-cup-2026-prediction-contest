# slice-roadmap.md — Plan detallado por slice

> Cada slice es **una rama Git + un PR + un tag**. Definición operativa: si el slice no se puede entregar en una rama independiente con sus tests verdes, está mal partido.

Para cada slice se lista: objetivo, alcance, fuera de alcance, dependencias, criterios de aceptación, modo Claude Code recomendado, y horas estimadas.

---

## Slice 1 — Esquema de BD + seeds

**Rama**: `slice-1-db-schema`  
**Modo**: `/effort high`  
**Estimación**: 4–6 h

### Objetivo

Tener el esquema completo de las 12 tablas creadas en Postgres, el seed inicial cargado (48 equipos + 104 partidos + admin bootstrap) y la tabla de combinaciones de mejores terceros generada.

### Alcance

- `lib/db/schema.ts` con las 12 tablas según `data-model.md`.
- `lib/db/index.ts` con el cliente Drizzle conectado a `DATABASE_URL`.
- Configurar `drizzle.config.ts`.
- Migración inicial generada con `drizzle-kit generate`.
- Seed: `lib/db/seed/teams.ts`, `lib/db/seed/matches.ts`, `lib/db/seed/index.ts`.
- Script `npm run db:migrate` (`drizzle-kit migrate`) y `npm run db:seed` (`tsx lib/db/seed/index.ts`).
- Script `npm run admin:bootstrap` que crea el primer admin con bcrypt desde `.env`.
- `lib/scoring/best-thirds-mapping.ts` con la tabla de 495 combinaciones generada desde la `Combinaciones` del Excel (script puntual de generación o tabla literal).
- Skill `add-migration` creada en `.claude/skills/add-migration/SKILL.md`.

### Fuera de alcance

- UI.
- Autenticación.
- Cálculo de puntos.

### Dependencias

- `data-model.md` aprobado (este doc).
- VPS no necesario; basta Postgres local.

### Criterios de aceptación

- [ ] `npm run db:migrate` aplica todas las migraciones sin error en BD vacía.
- [ ] `npm run db:seed` rellena 48 equipos y 104 partidos. Es idempotente (segunda ejecución no duplica).
- [ ] `npm run admin:bootstrap` crea el primer admin si no existe.
- [ ] Test: `select count(*) from teams` → 48; `from matches` → 104; `from matches where phase='grupos'` → 72.
- [ ] Test unitario sobre `BEST_THIRDS_MAPPING`: para 3 combinaciones conocidas, devuelve los matches correctos.
- [ ] Tipos Drizzle `$inferSelect` / `$inferInsert` compilan sin errores en TS estricto.

---

## Slice 2 — Auth con invitaciones

**Rama**: `slice-2-auth`  
**Modo**: `/effort high`  
**Estimación**: 6–8 h

### Objetivo

Sistema completo de login/registro con invitación, sesiones en cookie httpOnly, y middleware que protege rutas.

### Alcance

- `lib/auth/password.ts`: hash/compare con bcrypt.
- `lib/auth/sessions.ts`: crear, validar, destruir sesión. 30 días de duración.
- `lib/auth/invitations.ts`: generar, validar, consumir token.
- `lib/auth/current-user.ts`: helper que devuelve `User | null` a partir de la cookie.
- `middleware.ts` en raíz: carga sesión y redirige sin autenticación.
- Página `/login` (Server Action).
- Página `/registro?token=...` (Server Action).
- Página `/logout` (POST, cierra sesión).
- Endpoint `/api/admin/invitations` (POST): genera invitación, devuelve URL una vez.
- Logger básico `lib/logger.ts`.
- Skill `add-api-route` creada.

### Fuera de alcance

- UI bonita (form mínimo funcional con shadcn). Pulido en slice 7.
- Recuperación de contraseña (no la necesitamos: el admin regenera invitación).
- 2FA.

### Dependencias

- Slice 1 cerrado.

### Criterios de aceptación

- [ ] Test unitario: `hashPassword` + `comparePassword` consistentes.
- [ ] Test unitario: token de invitación caducado → rechaza.
- [ ] Test unitario: token usado → rechaza.
- [ ] Test e2e Playwright: flujo completo registro con token válido → login → ver página protegida.
- [ ] Test e2e: acceso a `/admin` sin sesión → 401/redirect.
- [ ] Test e2e: acceso a `/admin` como no-admin → 403.
- [ ] Cookie tiene `HttpOnly`, `Secure` (en prod), `SameSite=Lax`, `Path=/`.
- [ ] Logout invalida la sesión en BD, no solo borra la cookie.

---

## Slice 3 — Panel admin mínimo

**Rama**: `slice-3-admin`  
**Modo**: `/effort high`  
**Estimación**: 4–6 h

### Objetivo

Páginas admin para generar invitaciones, listar usuarios, e introducir resultados de partidos.

### Alcance

- `/admin` (dashboard básico).
- `/admin/invitaciones`: formulario para generar invitación con nota; lista de invitaciones activas y usadas; copiar URL al portapapeles.
- `/admin/usuarios`: tabla de usuarios con nickname, email, fecha de registro.
- `/admin/partidos`: tabla con los 104 partidos; permite introducir/editar marcadores y `real_winner_team_code` (para knockouts).
- `/admin/clasificaciones`: introducir `actual_group_standings` por grupo, los 8 `actual_best_thirds`, y `actual_awards`.
- Todas las Server Actions con validación zod y check de admin.

### Fuera de alcance

- Recalculo automático de puntos (eso es slice 5).
- Borrar usuarios (no se necesita).
- Editar usuarios.

### Dependencias

- Slice 2.

### Criterios de aceptación

- [ ] Solo accesible con `is_admin=true`.
- [ ] Generar invitación: aparece la URL una sola vez (modal/toast), luego solo se ve el id.
- [ ] Editar marcador de un partido marca `status='finished'` si ambos goles están y, para grupos, calcula `real_winner_team_code` automáticamente.
- [ ] Test e2e: admin genera invitación → URL copiable funciona.
- [ ] Test e2e: admin introduce marcador → se persiste y aparece en `/admin/partidos`.

---

## Slice 4 — Formulario de porra (EL GRANDE)

**Rama**: `slice-4-porra-form`  
**Modo**: `/effort high` por subtab; al final, sesión con `/effort ultracode` para revisar coherencia global  
**Estimación**: 16–24 h (es el slice más caro)

### Objetivo

Formulario completo que captura las 9 categorías de predicciones del usuario, con guardado parcial, validaciones cruzadas y bloqueo temporal.

### Alcance

UI con tabs/stepper. Orden de tabs:

1. **Grupos A–L** (uno por sub-tab anidado): marcador exacto de 6 partidos + orden 1–4 del grupo.
2. **Mejores terceros**: arrastrar 12 a top 8 ordenados.
3. **1/16**: 16 cruces.
4. **1/8**: 8 cruces.
5. **Cuartos**: 4 cruces.
6. **Semis**: 2 cruces.
7. **3.º/4.º + Final**: 2 cruces.
8. **Podio**: campeón, subcampeón, 3.º (auto-rellenado desde tabs anteriores, editable).
9. **Premios individuales**: 3 botas + 3 balones.

Backend:
- Server Action por tab (`saveGroupMatches`, `saveGroupStandings`, `saveBestThirds`, `saveKnockout`, `saveAwards`).
- Cada Server Action: valida zod + check de bloqueo + upsert.
- Componente que muestra "PORRA INCOMPLETA: faltan X apuestas" en sticky footer hasta completar.
- Hook `useAutoSave` que dispara la Server Action con debounce 800ms.

Skill nueva: `add-prediction-type`.

### Fuera de alcance

- Visualización de las porras de otros usuarios (slice 7).
- Modo "ver mi porra ya bloqueada" — eso sale gratis al hacer las rutas read-only post-bloqueo.

### Dependencias

- Slice 2 (necesita auth).
- Slice 1 (necesita catálogo).

### Criterios de aceptación

- [ ] Se puede rellenar la porra completa de un tirón sin perder datos al cambiar de tab.
- [ ] Refrescar la página no pierde lo guardado.
- [ ] Validación cruzada: el campeón debe estar entre los finalistas predichos (warning visible, no bloqueante).
- [ ] Tras bloqueo (simulado moviendo `TOURNAMENT_START_AT` a pasado), todas las Server Actions rechazan writes con error claro.
- [ ] Test e2e completo: usuario rellena 9 tabs → recarga página → ve sus datos → da OK.
- [ ] Test unitario: validador zod de cada categoría con casos límite (goles negativos, equipo duplicado en standings, etc.).
- [ ] Sub-agente `porra-form-tester` puede ejecutar la porra de forma headless.

---

## Slice 5 — Motor de puntuación

**Rama**: `slice-5-scoring-engine`  
**Modo**: `/effort high` con TDD estricto; subagente `scoring-auditor` al final  
**Estimación**: 8–10 h

### Objetivo

Función pura `calculateUserScore(userId)` que aplica todas las reglas de `scoring-rules.md` y persiste el desglose en `scores`. Idempotente.

### Alcance

- `lib/scoring/index.ts`: orquestador.
- `lib/scoring/group-matches.ts`: §3.1 reglas.
- `lib/scoring/group-standings.ts`: §3.2.
- `lib/scoring/best-thirds.ts`: §3.3.
- `lib/scoring/bracket.ts`: §3.4.
- `lib/scoring/podium.ts`: §3.5.
- `lib/scoring/awards.ts`: §3.6.
- `lib/scoring/penalties.ts`: §4.
- `lib/scoring/locks.ts`: funciones de "está bloqueada esta predicción ahora".
- Hook desde admin actions: tras editar resultado, recalcular para todos los usuarios afectados (transacción + entrada en `score_recalculations`).
- Skill nueva: `test-scoring-rule`.
- Subagente nuevo: `scoring-auditor`.

### Fuera de alcance

- UI de ranking (slice 7).
- Tiebreakers de ranking (slice 7).

### Dependencias

- Slices 1, 3.

### Criterios de aceptación

- [ ] **Cada función de cálculo** tiene su test unitario con al menos 5 casos (acierto pleno, acierto parcial, error, vacío con penalización, edge case).
- [ ] Función `calculateUserScore` es idempotente: ejecutarla dos veces deja la BD igual.
- [ ] Test de integración: dado un usuario con porra X y resultados oficiales Y, el desglose en `scores` coincide con lo calculado a mano (tabla en el test).
- [ ] El subagente `scoring-auditor` ejecuta sin señalar inconsistencias entre código y `scoring-rules.md`.
- [ ] Recalcular tras editar 1 partido afecta solo a las categorías relevantes (no recomputa todo).

---

## Slice 6 — Mejores terceros (combinatorio)

**Rama**: `slice-6-best-thirds`  
**Modo**: **Ultracode**, prompt explícito: "Implementa la resolución de mejores terceros desde 3 ángulos independientes y elige el más limpio"  
**Estimación**: 4–6 h

### Objetivo

Función que dados los `actual_best_thirds` (8 equipos ordenados), resuelve qué equipo va a cada `match_id` de 1/16. Esto materializa los `home_team_code`/`away_team_code` de los matches knockout que tenían slot_ref tipo `3ABCDF`.

### Alcance

- `lib/scoring/resolve-best-thirds.ts`: la función principal.
- Tests con las 495 combinaciones (no todos los casos, pero al menos 20 representativos).
- Hook desde admin action: tras introducir los 8 terceros, resolver y poblar los matches afectados.
- Workflow guardado: `/explore-multiple-approaches` (se ejecuta una vez y se descarta).

### Fuera de alcance

- Cualquier UI más allá del admin existente.

### Dependencias

- Slice 1 (tabla `BEST_THIRDS_MAPPING`).
- Slice 3 (admin para meter terceros).

### Criterios de aceptación

- [ ] Tests con 20 combinaciones conocidas pasan.
- [ ] Función es pura (no toca BD), la BD se actualiza desde el caller.
- [ ] Si el admin cambia los terceros, los matches se reasignan correctamente y los scores se recalculan.

---

## Slice 7 — Clasificación y vistas

**Rama**: `slice-7-views`  
**Modo**: `/effort high`  
**Estimación**: 8–10 h

### Objetivo

Páginas de usuario final: ranking, mi porra, porra de otro usuario, calendario de partidos.

### Alcance

- `/clasificacion`: tabla con ranking general + columnas por categoría (puntos grupos / bracket / podio / etc.).
- `/clasificacion/empate`: aplica los tiebreakers de `scoring-rules.md §7` y muestra el orden final.
- `/usuario/[nickname]`: ver porra de otro usuario (solo predicciones ya bloqueadas; las abiertas se ocultan).
- `/mi-porra` (sinónimo de `/porra` pero en modo solo lectura).
- `/partidos`: calendario por jornadas; ver resultados oficiales; ver tu predicción y los puntos que sacaste.
- Indicador en navbar de "Faltan N partidos para que se bloquee tu porra".

### Fuera de alcance

- Notificaciones push o email.
- Comentarios o chat.

### Dependencias

- Slices 4, 5.

### Criterios de aceptación

- [ ] Test e2e: dos usuarios con porras distintas → ranking correcto.
- [ ] Predicción no bloqueada de otro usuario NO se ve nunca.
- [ ] Tiebreakers aplicados según §7 cuando hay empate a puntos.
- [ ] Mobile responsive (la mayoría va a entrar desde el móvil).

---

## Slice 8 — Pulido y deploy a producción

**Rama**: `slice-8-pulido-deploy`  
**Modo**: `/effort high` para fixes; **Workflow `/audit-porra-pre-launch`** una sola vez  
**Estimación**: 6–10 h

### Objetivo

Que la app esté lista para usar por personas reales sin que se rompa. Auditoría de seguridad, accesibilidad, performance.

### Alcance

- Workflow `/audit-porra-pre-launch` que corre en paralelo: seguridad, performance, accesibilidad AA, SEO, cobertura de tests.
- Fix de issues que salgan.
- `app/api/health/route.ts` para health checks.
- `robots.txt` que bloquea indexación del subdominio (no queremos Google indexando la porra).
- CI completo en GitHub Actions: lint + tests + build + push de imagen a GHCR.
- Script `infra/scripts/deploy.sh` en el VPS que tira `podman-compose pull && up -d`.
- Backup remoto a Backblaze B2 (cron semanal).
- Subagente `migration-reviewer` y skill `deploy-vps`.

### Fuera de alcance

- Monitorización avanzada (basta `podman logs` por ahora).
- Métricas Prometheus/Grafana.

### Dependencias

- Slices 1–7 completos.

### Criterios de aceptación

- [ ] Workflow de auditoría devuelve informe limpio (o con issues conocidos documentados).
- [ ] Lighthouse mobile: Performance > 80, Accessibility > 90.
- [ ] Headers de seguridad: CSP, X-Frame-Options, Referrer-Policy.
- [ ] CI/CD: push a `main` → deploy automático al VPS.
- [ ] Backup local nocturno + remoto semanal funcionando.
- [ ] Smoke test post-deploy: `/api/health` responde 200 con `{ db: 'ok' }`.
- [ ] Test e2e: invitar a un amigo de prueba, que se registre desde su móvil, rellene la porra, y todo OK.

---

## Calendario sugerido (15 días)

| Día | Tarea | Notas |
|---|---|---|
| 1 | Fases 0–6 de `getting-started.md` | VPS provisto, repo creado, docs dentro |
| 2 | Slice 1 | Schema + seeds |
| 3 | Slice 1 (cierre) + Slice 2 inicio | |
| 4 | Slice 2 (cierre) | Auth |
| 5 | Slice 3 | Admin |
| 6–10 | Slice 4 | El gordo |
| 11 | Slice 5 inicio | Scoring |
| 12 | Slice 5 (cierre) + Slice 6 | Best thirds con ultracode |
| 13 | Slice 7 | Vistas |
| 14 | Slice 8 + workflow auditoría | |
| 15 | Buffer + invitar a los 15 jugadores + enviar URLs | |

Hito final: **11 jun, 17:00 hora España** → bloqueo automático global y el partido inaugural empieza.
