# 0005 — Podio sugerido desde el bracket, no persistido en el render

**Fecha**: 2026-06-09
**Estado**: aceptada

## Contexto

El tab "Podio" (sub-slice 4.6) deriva los 3 puestos del bracket: ganador de la
final → campeón, el otro finalista → subcampeón, ganador del 3-4 → 3.º
(`lib/scoring/deduce-podium.ts`).

La primera implementación hacía un **prefill que escribía en `predictions_awards`
durante el render del server component** (`load-podium.ts`): si el usuario no
tenía filas de podio y el bracket permitía deducir algo, se insertaba.

Una auditoría (informe ultracode, CRÍTICO 2) detectó que esto es problemático:

- **Escritura en un GET**: el render de `/porra` (incluido un prefetch de Next)
  provocaba un INSERT. Rompe la idempotencia del render y crea predicciones que
  el usuario nunca eligió explícitamente.
- **Carrera de lectura/escritura**: `loadPodium` (que insertaba) corría en el
  mismo `Promise.all` que `loadUserPredictions` (que leía `predictions_awards`),
  así que en el primer acceso el resumen global podía no ver las filas recién
  prefilladas → el tab mostraba un podio lleno mientras el footer lo contaba como
  hueco.
- **Sin red de tests**: los e2e que cubrían el prefill estaban `test.skip`.

## Decisión

El podio derivado del bracket es una **sugerencia que el jugador confirma o
edita**, no un valor que se persista solo.

- `loadPodium` pasa a ser **lectura pura**: devuelve `persisted` (lo guardado en
  `predictions_awards`) y `suggested` (la deducción del bracket). No escribe.
- El tab muestra el valor sugerido en el campo, etiquetado como **"Sugerido por
  tu bracket — confirma o edita"** y en estado **pendiente** (no marcado como
  guardado).
- La persistencia ocurre **solo** cuando el usuario confirma o edita un puesto,
  vía la Server Action `savePodiumPrediction` (con su lock check y validación).
- El resumen global (`computePorraSummary`) cuenta un puesto sugerido como **no
  hueco** pero marca el tab en **"revisar"** mientras siga sin confirmar. Esto es
  distinto de *stale* (puesto guardado que ya no coincide con el bracket actual,
  que ofrece "Sincronizar").

## Consecuencias

**Ganamos**:
- El render de `/porra` vuelve a ser idempotente: ningún GET escribe en BD.
- Desaparece la carrera `loadPodium`/`loadUserPredictions`.
- El usuario tiene control explícito: ve la sugerencia pero decide guardarla.

**Perdemos**:
- Un puesto solo sugerido (sin confirmar) **no puntúa** si el usuario no actúa
  antes del cierre. Es coherente con scoring-rules.md §4 (lo no rellenado no
  suma) y se avisa de forma muy visible ("revisar").
- Un paso manual más respecto al auto-relleno silencioso.

**Sin recálculo retroactivo**: este cambio afecta a *cómo se captura* el podio,
no a *cómo se puntúa* (scoring-rules.md §3.5 intacto). No hay puntos que
recalcular.

## Alternativas consideradas

- **Mantener el prefill pero moverlo a una Server Action** disparada al montar el
  tab: elimina el write-on-GET pero sigue persistiendo algo que el usuario no
  eligió, y añade un efecto al montar. Descartada por menos transparente.
- **Persistir la sugerencia al tocar cualquier campo del podio**: confirmaría
  puestos que el usuario no miró. Descartada: cada puesto se confirma de forma
  independiente.
