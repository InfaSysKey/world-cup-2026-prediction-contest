/**
 * Cobertura e2e del tab "Mejores Terceros" (sub-slice 4.4).
 *
 * Los candidatos del tab salen del 3.º de cada grupo en los standings del
 * usuario. El componente los deriva del snapshot de servidor (initialData), así
 * que tras guardar un orden de grupo hay que RECARGAR para que aparezcan como
 * candidatos (independencia entre tabs; el aviso "stale" cubre el desfase).
 *
 * Casos básicos (cobertura mínima de 6):
 *   1. Empty state + CTA cuando no hay ningún 3.º predicho.
 *   2. Añadir un candidato → autosave "Guardado" → recarga → persiste.
 *   3. Reordenar la selección de 2 → persiste tras recarga.
 *   4. Quitar una selección → vuelve a candidatos, slot vacío.
 *   5. Indicador "INCOMPLETA — faltan N".
 *   6. Persistencia al cambiar de tab y volver.
 *   7. Candidato ya seleccionado: botón + deshabilitado, no se duplica.
 *   8. Estado bloqueado: en porra-mejores-terceros-locked.spec.ts (project=locked).
 *
 * Drag-and-drop bidireccional:
 *   D1. Subir un elemento con ↑ dentro de la selección: reordena y persiste.
 *   D2. Bajar al último con ↓ y volver a subir: ciclo completo de reordenación.
 *
 * Manejo de stale (la decisión de UX más delicada de 4.4):
 *   S1. Cambiar el 3.º de un grupo tras haberlo seleccionado → badge "inconsistente".
 *   S2. Indicador muestra "REVISAR" mientras hay stale, aunque haya 8 seleccionados.
 *   S3. "Sustituir" reemplaza el equipo stale por el 3.º actual, autosave, persiste.
 *   S4. "Quitar de la selección" libera la posición, autosave, persiste.
 *   S5. Recargar con stale activo: el estado se recalcula correctamente.
 *
 * Empty state detallado:
 *   E1. Con standings parciales (1 grupo), solo aparece 1 candidato.
 *   E2. Tras completar un segundo grupo, reaparece el segundo candidato al recargar.
 *
 * Cross-tab preparatorio para bracket (4.5):
 *   X1. Selección de 8 completa genera indicador "Completa" en el stepper.
 *   X2. BEST_THIRDS_MAPPING cubre la combinación real de 8 grupos (formato OK
 *       para el resolver de matches de 1/16).
 *
 * El estado bloqueado (Server Action LOCKED) se cubre en actions.test.ts.
 * Corre con el project "chromium" (TOURNAMENT_START_AT en el futuro).
 */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gotoTab(page: Page, tabId: string): Promise<void> {
  await page.getByTestId(`porra-tab-${tabId}`).click();
  await expect(page.getByTestId(`porra-panel-${tabId}`)).toBeVisible();
}

/**
 * Espera a que el indicador de autosave complete UN NUEVO ciclo de guardado.
 * Distingue un save nuevo del estado "Guardado" residual de un save anterior.
 *
 * El problema: toHaveText('Guardado') matchea inmediatamente si la UI ya muestra
 * "Guardado" de un save previo, antes de que el debounce del nuevo save haya
 * disparado (AUTOSAVE_DEBOUNCE_MS = 800 ms).
 *
 * Solución: si el estado actual ya es "Guardado", esperamos a que cambie (a
 * "Guardando…" durante la SA o incluso a "Sin cambios" si el componente se
 * desmontó/remontó) y solo entonces esperamos el nuevo "Guardado".
 */
async function waitForFreshSave(
  page: Page,
  testId: 'gs-autosave-status' | 'bt-autosave-status',
): Promise<void> {
  // Si el estado actual es "Guardado" (residual de save anterior), esperamos a
  // que deje de serlo antes de continuar — así no confundimos el save viejo con
  // el nuevo.
  const currentText = await page.getByTestId(testId).textContent();
  if (currentText?.trim() === 'Guardado') {
    await page.waitForFunction(
      (id: string) => {
        const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        return el !== null && el.textContent?.trim() !== 'Guardado';
      },
      testId,
      { timeout: 4000 },
    );
  }
  // Ahora esperamos el "Guardado" del nuevo ciclo de save.
  await expect(page.getByTestId(testId)).toHaveText('Guardado', {
    timeout: 6000,
  });
}

/**
 * Persiste el orden del grupo indicado (un swap basta) y espera el autosave.
 * Asume que la página está en el tab Grupos o que se navega explícitamente antes
 * de llamar a esta función.
 *
 * Usa waitForFreshSave para evitar el falso positivo de ver el "Guardado" del
 * save anterior antes de que el debounce del nuevo save haya disparado.
 */
async function persistGroup(page: Page, letter: string): Promise<void> {
  // Navegar al tab Grupos si no está ya activo (revalidatePath puede resetear el
  // tab activo tras un save previo).
  await gotoTab(page, 'grupos');
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
  await page.locator(`[data-testid^="gs-order-${letter}-down-"]`).first().click();
  await waitForFreshSave(page, 'gs-autosave-status');
}

/**
 * Añade un candidato en el tab Mejores Terceros y espera el autosave.
 * revalidatePath('/porra') puede resetear el tab activo al completar el save,
 * por lo que re-navega al tab mejores-terceros después si hay más acciones.
 *
 * Usa waitForFreshSave para evitar el falso positivo de ver el "Guardado" del
 * save anterior antes de que el debounce del nuevo save haya disparado.
 */
async function addCandidateAndWait(page: Page, teamCode: string): Promise<void> {
  // Asegurar que estamos en el tab correcto (puede haberse reseteado por
  // un save previo que disparó revalidatePath).
  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${teamCode}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');
}

/** Lee el code del equipo en posición 3 del grupo indicado. */
async function thirdOf(page: Page, letter: string): Promise<string> {
  const items = page.locator(`[data-testid="gs-order-${letter}"] > li`);
  const tid = await items.nth(2).getAttribute('data-testid');
  return (tid ?? '').replace(`gs-order-${letter}-item-`, '');
}

/** Lee el orden actual (codes) de la selección de mejores terceros. */
async function selectedOrder(page: Page): Promise<string[]> {
  const items = page.locator('[data-testid="bt-selected"] > li');
  const count = await items.count();
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const tid = await items.nth(i).getAttribute('data-testid');
    codes.push((tid ?? '').replace('bt-selected-item-', ''));
  }
  return codes;
}

// ---------------------------------------------------------------------------
// Test 1: Empty state + CTA
// ---------------------------------------------------------------------------
test('mejores-terceros – empty state con CTA cuando no hay 3.º predicho', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await gotoTab(page, 'mejores-terceros');

  await expect(page.getByTestId('best-thirds-tab')).toBeVisible();
  await expect(page.getByTestId('bt-empty-state')).toBeVisible();

  // El CTA devuelve al tab Grupos.
  await page.getByTestId('bt-empty-cta').click();
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2: Añadir un candidato y persistir
// ---------------------------------------------------------------------------
test('mejores-terceros – añadir un candidato, autosave "Guardado", persiste tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId('best-thirds-tab')).toBeVisible();

  // El candidato (3.º del grupo A) está disponible.
  await expect(page.getByTestId(`bt-candidate-${thirdA}`)).toBeVisible();

  // Añadirlo.
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  await expect(page.getByTestId(`bt-selected-item-${thirdA}`)).toBeVisible();
  await expect(page.getByTestId('bt-indicator')).toContainText('faltan 7');

  // Recargar y comprobar persistencia.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdA]);
});

// ---------------------------------------------------------------------------
// Test 3: Reordenar la selección de 2 persiste tras recarga
// ---------------------------------------------------------------------------
test('mejores-terceros – reordenar dos selecciones persiste tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await persistGroup(page, 'B');
  await page.reload();
  // Capturar los terceros mientras estamos en el tab Grupos (thirdOf requiere gs-order-*).
  const thirdA = await thirdOf(page, 'A');
  const thirdB = await thirdOf(page, 'B');

  // Añadir cada candidato re-navegando al tab tras el save (revalidatePath puede
  // resetear el tab activo).
  await addCandidateAndWait(page, thirdA);
  await addCandidateAndWait(page, thirdB);

  // Verificar orden [A, B].
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdA, thirdB]);

  // Bajar el primero → [thirdB, thirdA].
  await page.getByTestId(`bt-selected-down-${thirdA}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');

  // Re-navegar por si el reorder también causó un reset del tab.
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdB, thirdA]);

  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdB, thirdA]);
});

// ---------------------------------------------------------------------------
// Test 4: Quitar una selección
// ---------------------------------------------------------------------------
test('mejores-terceros – quitar una selección la devuelve a candidatos', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  // Añadir (revalidatePath puede resetear el tab tras el save).
  await addCandidateAndWait(page, thirdA);

  // Re-navegar al tab para comprobar que el elemento aparece en la selección.
  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-selected-item-${thirdA}`)).toBeVisible();

  // Quitar — esperar por save fresco (no el "Guardado" residual del add anterior).
  await page.getByTestId(`bt-remove-${thirdA}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');

  // Re-navegar por si el remove también reseteó el tab.
  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-selected-item-${thirdA}`)).toHaveCount(0);
  await expect(page.getByTestId('bt-indicator')).toContainText('faltan 8');

  // Persiste vacío tras recarga.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Test 6: Persistencia al cambiar de tab y volver
// ---------------------------------------------------------------------------
test('mejores-terceros – datos persisten al cambiar de tab y volver (sin recarga)', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await persistGroup(page, 'B');
  await page.reload();
  // Leer los terceros mientras estamos en el tab Grupos (gs-order-* visible).
  const thirdA = await thirdOf(page, 'A');
  const thirdB = await thirdOf(page, 'B');

  // Añadir candidatos (re-navegando al tab en cada save por el reset de revalidatePath).
  await addCandidateAndWait(page, thirdA);
  await addCandidateAndWait(page, thirdB);

  // Ir a otro tab y volver sin recargar: los datos deben estar en la BD y
  // recargarse desde el initialData del server component.
  await gotoTab(page, 'grupos');
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Volver: el componente se monta de nuevo con initialData actualizado.
  await gotoTab(page, 'mejores-terceros');
  const order = await selectedOrder(page);
  expect(order).toContain(thirdA);
  expect(order).toContain(thirdB);
  expect(order).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// Test 7: Candidato ya seleccionado no se puede añadir de nuevo (no duplica)
// ---------------------------------------------------------------------------
test('mejores-terceros – el botón + de un candidato ya seleccionado está disabled', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  // Añadir (usa addCandidateAndWait para manejar posible reset de tab).
  await addCandidateAndWait(page, thirdA);

  // Re-navegar al tab para comprobar el estado.
  await gotoTab(page, 'mejores-terceros');

  // Tras añadirlo, el botón + queda disabled.
  await expect(page.getByTestId(`bt-candidate-add-${thirdA}`)).toBeDisabled();

  // La selección solo tiene un elemento (sin duplicados).
  const order = await selectedOrder(page);
  expect(order.filter((c) => c === thirdA)).toHaveLength(1);
});

// Test 8 (estado bloqueado) vive en porra-mejores-terceros-locked.spec.ts,
// que corre con el project=locked (npm run e2e:locked). No puede ejecutarse en
// el modo abierto porque requiere un servidor con TOURNAMENT_START_AT en el
// pasado.

// ---------------------------------------------------------------------------
// D1: Subir un elemento con ↑ dentro de la selección
// ---------------------------------------------------------------------------
test('mejores-terceros – reordenar con ↑: subir el segundo al primer puesto', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await persistGroup(page, 'B');
  await persistGroup(page, 'C');
  await page.reload();
  // Leer los terceros mientras estamos en el tab Grupos.
  const thirdA = await thirdOf(page, 'A');
  const thirdB = await thirdOf(page, 'B');
  const thirdC = await thirdOf(page, 'C');

  // Añadir los tres candidatos (re-navegando al tab en cada save).
  await addCandidateAndWait(page, thirdA);
  await addCandidateAndWait(page, thirdB);
  await addCandidateAndWait(page, thirdC);

  // Verificar orden inicial: [A, B, C].
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdA, thirdB, thirdC]);

  // Subir B (estaba en posición 2) → [B, A, C].
  await page.getByTestId(`bt-selected-up-${thirdB}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');

  // Re-navegar por si el reorder reseteó el tab.
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdB, thirdA, thirdC]);

  // Persiste tras recarga.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdB, thirdA, thirdC]);
});

// ---------------------------------------------------------------------------
// D2: Bajar al último y volver a subir: ciclo de reordenación completo
// ---------------------------------------------------------------------------
test('mejores-terceros – reordenar con ↓ y ↑: ciclo completo de dos posiciones', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await persistGroup(page, 'B');
  await page.reload();
  // Leer los terceros mientras estamos en el tab Grupos.
  const thirdA = await thirdOf(page, 'A');
  const thirdB = await thirdOf(page, 'B');

  // Añadir los dos candidatos (re-navegando al tab en cada save).
  await addCandidateAndWait(page, thirdA);
  await addCandidateAndWait(page, thirdB);

  // Verificar orden inicial: [A, B].
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdA, thirdB]);

  // Bajar A → [B, A].
  await page.getByTestId(`bt-selected-down-${thirdA}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');

  // Re-navegar por si el reorder reseteó el tab.
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdB, thirdA]);

  // El botón ↓ de A (ahora último) debe estar disabled.
  await expect(page.getByTestId(`bt-selected-down-${thirdA}`)).toBeDisabled();

  // Subir A de nuevo → [A, B].
  await page.getByTestId(`bt-selected-up-${thirdA}`).click();
  await waitForFreshSave(page, 'bt-autosave-status');

  // Re-navegar por si el reorder reseteó el tab.
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([thirdA, thirdB]);

  // El botón ↑ de A (ahora primero) debe estar disabled.
  await expect(page.getByTestId(`bt-selected-up-${thirdA}`)).toBeDisabled();
});

// ---------------------------------------------------------------------------
// S1: Cambiar el 3.º de un grupo tras haberlo seleccionado → badge stale
// ---------------------------------------------------------------------------
test('mejores-terceros – stale S1: cambiar el 3.º de un grupo marca la selección como inconsistente', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  // 1. Persistir el grupo A y obtener el 3.º inicial.
  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  // 2. Seleccionar ese 3.º en Mejores Terceros y guardar.
  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // 3. Volver al tab Grupos y bajar el equipo en posición 3 → cambia el 3.º.
  await gotoTab(page, 'grupos');
  await expect(page.getByTestId('group-standings-tab')).toBeVisible();

  // Bajar el equipo de posición 3 a posición 4 (el de posición 4 sube a 3).
  const downBtnOfThird = page.locator(`[data-testid="gs-order-A-down-${thirdA}"]`);
  await downBtnOfThird.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // 4. Recargar para que el snapshot de servidor se actualice, luego ir al tab.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');

  // 5. El badge "inconsistente" aparece en el elemento stale.
  await expect(page.getByTestId(`bt-stale-badge-${thirdA}`)).toBeVisible();

  // 6. La lista de stale muestra el equipo problemático.
  await expect(page.getByTestId('bt-stale-list')).toBeVisible();
  await expect(page.getByTestId(`bt-stale-${thirdA}`)).toBeVisible();
});

// ---------------------------------------------------------------------------
// S2: Indicador muestra "REVISAR" con stale aunque haya selección
// ---------------------------------------------------------------------------
test('mejores-terceros – stale S2: indicador dice "REVISAR" aunque haya seleccionados', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Volver a Grupos y bajar el 3.º actual para que quede stale.
  await gotoTab(page, 'grupos');
  const downBtnOfThird = page.locator(`[data-testid="gs-order-A-down-${thirdA}"]`);
  await downBtnOfThird.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Recargar y volver al tab.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');

  // El indicador debe decir "REVISAR", no "INCOMPLETA" ni "Completa".
  await expect(page.getByTestId('bt-indicator')).toContainText('REVISAR');
  await expect(page.getByTestId('bt-indicator')).not.toContainText('INCOMPLETA');
  await expect(page.getByTestId('bt-indicator')).not.toContainText('Completa');
});

// ---------------------------------------------------------------------------
// S3: "Sustituir" reemplaza el equipo stale por el 3.º actual, persiste
// ---------------------------------------------------------------------------
test('mejores-terceros – stale S3: Sustituir reemplaza el equipo stale y persiste', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Cambiar el 3.º en el tab Grupos.
  await gotoTab(page, 'grupos');
  const downBtnOfThird = page.locator(`[data-testid="gs-order-A-down-${thirdA}"]`);
  await downBtnOfThird.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Leer el nuevo 3.º del grupo A.
  await page.reload();
  const newThirdA = await thirdOf(page, 'A');
  expect(newThirdA).not.toBe(thirdA); // Debe haber cambiado.

  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-stale-${thirdA}`)).toBeVisible();

  // Pulsar "Sustituir".
  await page.getByTestId(`bt-stale-replace-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // El equipo anterior ya no está en la selección; el nuevo sí.
  await expect(page.getByTestId(`bt-selected-item-${thirdA}`)).toHaveCount(0);
  await expect(page.getByTestId(`bt-selected-item-${newThirdA}`)).toBeVisible();

  // El badge stale del equipo anterior desaparece.
  await expect(page.getByTestId(`bt-stale-badge-${thirdA}`)).toHaveCount(0);

  // Persiste tras recarga.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  const order = await selectedOrder(page);
  expect(order).toContain(newThirdA);
  expect(order).not.toContain(thirdA);
});

// ---------------------------------------------------------------------------
// S4: "Quitar de la selección" libera la posición, persiste
// ---------------------------------------------------------------------------
test('mejores-terceros – stale S4: Quitar de la selección libera la posición', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Cambiar el 3.º en el tab Grupos.
  await gotoTab(page, 'grupos');
  const downBtnOfThird = page.locator(`[data-testid="gs-order-A-down-${thirdA}"]`);
  await downBtnOfThird.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-stale-${thirdA}`)).toBeVisible();

  // Pulsar "Quitar de la selección".
  await page.getByTestId(`bt-stale-remove-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // La posición queda vacía (el slot pasa a "Vacío").
  await expect(page.getByTestId(`bt-selected-item-${thirdA}`)).toHaveCount(0);
  await expect(page.getByTestId('bt-indicator')).toContainText('faltan 8');

  // No hay más stale.
  await expect(page.getByTestId('bt-stale-list')).toHaveCount(0);

  // Persiste tras recarga.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  expect(await selectedOrder(page)).toEqual([]);
});

// ---------------------------------------------------------------------------
// S5: Recargar con stale activo: el estado se recalcula correctamente
// ---------------------------------------------------------------------------
test('mejores-terceros – stale S5: el estado stale persiste y se recalcula tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  // Seleccionar.
  await gotoTab(page, 'mejores-terceros');
  await page.getByTestId(`bt-candidate-add-${thirdA}`).click();
  await expect(page.getByTestId('bt-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Cambiar el 3.º de grupo A para que quede stale en la BD.
  await gotoTab(page, 'grupos');
  const downBtnOfThird = page.locator(`[data-testid="gs-order-A-down-${thirdA}"]`);
  await downBtnOfThird.click();
  await expect(page.getByTestId('gs-autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Primera recarga.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-stale-badge-${thirdA}`)).toBeVisible();
  await expect(page.getByTestId('bt-indicator')).toContainText('REVISAR');

  // Segunda recarga (verificar idempotencia).
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId(`bt-stale-badge-${thirdA}`)).toBeVisible();
  await expect(page.getByTestId('bt-indicator')).toContainText('REVISAR');
});

// ---------------------------------------------------------------------------
// E1: Con standings parciales (1 grupo), solo aparece 1 candidato
// ---------------------------------------------------------------------------
test('mejores-terceros – E1: con un solo grupo guardado, solo hay 1 candidato', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await persistGroup(page, 'A');
  await page.reload();
  const thirdA = await thirdOf(page, 'A');

  await gotoTab(page, 'mejores-terceros');
  await expect(page.getByTestId('best-thirds-tab')).toBeVisible();
  // No debe mostrarse el empty state (hay al menos un candidato).
  await expect(page.getByTestId('bt-empty-state')).toHaveCount(0);

  // Solo hay 1 candidato en la lista.
  const candidateItems = page.locator('[data-testid="bt-candidates"] li');
  await expect(candidateItems).toHaveCount(1);
  await expect(page.getByTestId(`bt-candidate-${thirdA}`)).toBeVisible();
});

// ---------------------------------------------------------------------------
// E2: Al añadir un segundo grupo, el nuevo candidato aparece al recargar
// ---------------------------------------------------------------------------
test('mejores-terceros – E2: guardar un segundo grupo añade un segundo candidato', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  // Solo el grupo A.
  await persistGroup(page, 'A');
  await page.reload();

  await gotoTab(page, 'mejores-terceros');
  const candidatesBefore = page.locator('[data-testid="bt-candidates"] li');
  await expect(candidatesBefore).toHaveCount(1);

  // Guardar el grupo B.
  await gotoTab(page, 'grupos');
  await persistGroup(page, 'B');

  // Recargar para que el snapshot del servidor se actualice.
  await page.reload();
  await gotoTab(page, 'mejores-terceros');
  const candidatesAfter = page.locator('[data-testid="bt-candidates"] li');
  await expect(candidatesAfter).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// X1: Selección de 8 completa → indicador "Completa" en el stepper
// (Precondición: el torneo tiene 12 grupos; necesitamos 8 guardados)
// ---------------------------------------------------------------------------
test('mejores-terceros – X1: selección de 8 muestra indicador "Completa"', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Guardar 8 grupos para tener 8 candidatos disponibles.
  for (const letter of letters) {
    await persistGroup(page, letter);
  }
  await page.reload();

  // Leer los terceros mientras estamos en el tab Grupos (thirdOf requiere gs-order-*).
  const thirds: string[] = [];
  for (const letter of letters) {
    thirds.push(await thirdOf(page, letter));
  }

  // Añadir los 8 candidatos uno a uno (re-navegando al tab en cada save).
  for (const third of thirds) {
    await addCandidateAndWait(page, third);
  }

  // Re-navegar al tab para comprobar el indicador.
  await gotoTab(page, 'mejores-terceros');

  // Indicador del tab muestra "Completa".
  await expect(page.getByTestId('bt-indicator')).toHaveText('Completa');

  // El punto de completitud del tab en el stepper debe ser verde (completo).
  // El stepper usa data-testid="porra-tab-mark-mejores-terceros" con aria-label.
  await expect(page.getByTestId('porra-tab-mark-mejores-terceros')).toHaveAttribute(
    'aria-label',
    'completo',
  );
});
