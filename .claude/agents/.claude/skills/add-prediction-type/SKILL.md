---
name: add-prediction-type
description: Use this skill when adding, modifying, or working on any prediction category in the porra form. Triggers when the user mentions prediction tabs, the porra form, prediction categories (group matches, group standings, best thirds, knockout, awards), or anything in components/porra/ or app/(porra)/.
---

# add-prediction-type

Toda categoría de predicción del formulario toca **siempre los mismos 7 sitios**. Esta skill garantiza que ninguno se quede a medias.

Es la salvaguarda contra el patrón típico "el agente hizo la UI pero olvidó el lock check" o "el agente hizo el validador pero la Server Action lo ignora".

## Cuándo usar

- Crear el tab de una nueva categoría (todas las del MVP están definidas en `scoring-rules.md §2`).
- Modificar una categoría existente (añadir un campo, cambiar una validación).
- Trabajar en `components/porra/` o `app/(porra)/porra/actions.ts`.
- Cualquier mención a "tab", "predicción", "formulario de porra".

## Las 5 categorías del MVP (recordatorio)

| Categoría | Tabla | Tab |
|---|---|---|
| Marcadores de fase de grupos | `predictions_group_matches` | Grupos |
| Orden 1–4 de cada grupo | `predictions_group_standings` | Grupos (sub-sección) |
| Mejores terceros (8 ordenados) | `predictions_best_thirds` | Mejores Terceros |
| Ganador de cada cruce eliminatorio | `predictions_knockout` | 1/16, 1/8, Cuartos, Semis, 3-4, Final |
| Podio + premios individuales | `predictions_awards` | Podio + Premios |

## Los 7 sitios a tocar (en orden)

### 1. Validador Zod en `lib/validators/predictions.ts`

Schema que valida el input que llega del cliente. **Reutilizable**: lo importan tanto el cliente (para validación inmediata) como la Server Action (para validación de seguridad).

```typescript
export const groupMatchPredictionSchema = z.object({
  matchId: z.number().int().min(1).max(72),
  golesLocal: z.number().int().min(0).max(20),
  golesVisitante: z.number().int().min(0).max(20),
});

export const groupMatchPredictionsBatchSchema = z.array(groupMatchPredictionSchema);
```

### 2. Server Action en `app/(porra)/porra/actions.ts`

Una acción por categoría. Estructura obligatoria de la skill `add-api-route`:

1. Auth check.
2. Lock check (paso 3 de esta skill).
3. Validar con Zod.
4. Upsert en BD (transacción si afecta a varias filas).
5. Respuesta tipada con `ApiResult<T>`.

```typescript
'use server';

export async function saveGroupMatchPredictions(
  formData: FormData
): Promise<ApiResult<{ saved: number }>> {
  const user = await getCurrentUser();
  if (!user) return { error: { code: 'UNAUTHENTICATED', message: 'Sesión requerida.' } };

  if (await isGroupMatchPredictionLocked()) {
    return { error: { code: 'LOCKED', message: 'Las predicciones ya están bloqueadas.' } };
  }

  const raw = JSON.parse(formData.get('predictions') as string);
  const parsed = groupMatchPredictionsBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: { code: 'INVALID_INPUT', message: 'Datos inválidos.' } };
  }

  // upsert en transacción
  // ...

  return { data: { saved: parsed.data.length } };
}
```

### 3. Lock check en `lib/scoring/locks.ts`

Función pura que dice si esta categoría está bloqueada **ahora**. Comparación con `now()`.

```typescript
export async function isGroupMatchPredictionLocked(): Promise<boolean> {
  // MVP: bloqueo global al primer partido del torneo
  const startAt = new Date(process.env.TOURNAMENT_START_AT!);
  return new Date() >= startAt;
}

// Más adelante, bloqueo granular por partido:
// export async function isGroupMatchPredictionLockedForMatch(matchId: number): Promise<boolean>
```

**Toda Server Action de predicción** llama a su lock check antes de escribir. **Toda lectura para el formulario** también lo usa para renderizar en modo read-only.

### 4. Componente del tab en `components/porra/<Categoria>Tab.tsx`

- `'use client'`.
- Recibe como prop el estado inicial (datos ya guardados + flag de bloqueo).
- Usa `useFormState` o estado local + el hook `useAutoSave` (debounce 800ms).
- Si `locked`, todos los inputs son `disabled` y se muestra el banner "BLOQUEADA".
- Estados visuales: guardando / guardado / error.

### 5. Integración en el stepper `components/porra/PorraStepper.tsx`

- Añadir el tab a la lista del stepper.
- Indicador de completitud del tab (✅ / ⚠️ / vacío).
- Navegación: el usuario puede saltar libremente entre tabs ya visitados, no hay orden forzado.

### 6. Stub del scoring en `lib/scoring/<categoria>.ts`

Una función vacía pero con la firma correcta, para que el slice 5 solo tenga que rellenar el cuerpo:

```typescript
// lib/scoring/group-matches.ts
export interface GroupMatchScore {
  matchId: number;
  points: number;
  reason: 'exact' | 'result' | 'one_goal' | 'wrong' | 'empty';
}

export async function scoreGroupMatches(userId: number): Promise<GroupMatchScore[]> {
  // TODO(slice-5): aplicar scoring-rules.md §3.1
  return [];
}
```

### 7. Tests

**Unit test** del validador en `lib/validators/predictions.test.ts`. Mínimo 4 casos:
- ✅ Input válido pasa.
- ❌ Goles negativos rechaza.
- ❌ matchId fuera de rango rechaza.
- ❌ Tipos incorrectos (string en vez de number) rechaza.

**E2E test** en `tests/e2e/porra-<categoria>.spec.ts`. Mínimo 3 casos:
- ✅ Usuario logueado rellena el tab → recarga página → ve sus datos.
- ✅ Cambio en input dispara autosave (espera 1s y comprueba indicador "Guardado").
- ✅ Si `TOURNAMENT_START_AT` está en pasado, los inputs aparecen `disabled` y la Server Action rechaza con `LOCKED`.

---

## Validaciones cruzadas entre tabs

Algunas categorías dependen de otras. Estas validaciones viven en `lib/validators/cross-tab.ts` y se ejecutan en el cliente (warning visible) **y** en el servidor (error si crítica):

| Regla | Severidad | Dónde |
|---|---|---|
| El equipo en `predictions_best_thirds` debe estar en 3.ª posición de algún grupo en `predictions_group_standings` del mismo usuario | warning | client + server |
| El equipo `champion` en `predictions_awards` debe ganar la final en `predictions_knockout` | warning | client |
| El equipo `runner_up` debe perder la final | warning | client |
| El equipo `third` debe ganar el 3-4 en `predictions_knockout` | warning | client |
| Un mismo equipo no puede aparecer dos veces en las 8 posiciones de mejores terceros | error | client + server |
| Un equipo no puede aparecer en dos posiciones del mismo grupo | error | client + server |

Warnings: indicador visual en sticky footer, **no bloquean** el guardado.  
Errores: rechazan la Server Action con código `INVALID_INPUT`.

---

## Auto-save: pattern obligatorio

Toda predicción se guarda con **autosave debounced**:

- Cliente mantiene estado local.
- Cualquier cambio dispara un debounce de 800 ms.
- Al expirar, llama a la Server Action.
- Mientras está guardando, indicador "Guardando…".
- Al volver, "Guardado · hace 2 s".
- Si falla, "Error al guardar · Reintentar" + reintento manual.

Hook canónico en `lib/hooks/use-auto-save.ts` (crear en sub-slice 4.1, reutilizar en todos los tabs).

**Anti-pattern**: botón "Guardar" explícito al final del tab. **Nunca** en este proyecto. El usuario abandona el tab a media porra y pierde los datos.

---

## Lectura inicial del tab

Al cargar la página de la porra, el server component lee **todas** las predicciones del usuario en una sola query (no una por tab), las pasa como props al stepper, y cada tab solo recibe su slice de datos. Esto evita un loading state por tab.

```typescript
// app/(porra)/porra/page.tsx (server component)
const predictions = await loadUserPredictions(user.id);
return <PorraStepper initialData={predictions} locks={await loadAllLocks()} />;
```

---

## Anti-patterns (rechazar al revisar)

- ❌ Server Action sin lock check.
- ❌ Botón "Guardar" manual en lugar de autosave.
- ❌ Validador Zod definido inline en el componente en lugar de en `lib/validators/`.
- ❌ Lectura de la BD desde el tab cliente en lugar de recibir props del server component.
- ❌ Tab sin test e2e.
- ❌ Mostrar mensaje técnico al usuario en caso de error de validación cruzada (ej. "FK violation").
- ❌ Modificar las tablas `predictions_*` sin pasar por la skill `add-migration`.
- ❌ Permitir editar predicción de otro usuario (no fiarse del `userId` que llegue del cliente, siempre tomarlo de la sesión).
- ❌ Tab que asume que las otras categorías ya están rellenas (cada tab debe poder guardar de forma independiente).
- ❌ Sin stub de scoring en `lib/scoring/<categoria>.ts`.
