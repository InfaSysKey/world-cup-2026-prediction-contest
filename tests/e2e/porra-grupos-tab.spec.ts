/**
 * Cobertura mínima del tab Grupos (sub-slice 4.2).
 * 6 tests según la plantilla de cobertura de porra-form-tester:
 *   1. Happy path "estado vacío"
 *   2. Happy path "rellenar y guardar"
 *   3. Autosave parcial
 *   4. Validación de input (valor inválido no dispara guardado)
 *   5. Estado bloqueado — ver porra-grupos-locked.spec.ts (project=locked)
 *   6. Persistencia entre tabs
 *
 * Corre con el project "chromium" (TOURNAMENT_START_AT en el futuro).
 */
import { expect, test } from '@playwright/test';

import {
  adminGenerateInvitationUrl,
  registerAndLand,
  uniqueSuffix,
} from '../fixtures/auth-helpers';

// ---------------------------------------------------------------------------
// Test 1: Happy path "estado vacío"
// ---------------------------------------------------------------------------
test('grupos – estado vacío: inputs vacíos, sin errores, autosave "Sin cambios"', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  // El tab Grupos está activo por defecto.
  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // El indicador de autosave está en estado neutro (sin cambios pendientes).
  await expect(page.getByTestId('autosave-status')).toHaveText('Sin cambios');

  // El primer partido del catálogo (id 1) tiene inputs vacíos.
  await expect(page.getByTestId('gm-local-1')).toHaveValue('');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('');

  // No aparece ningún mensaje de error.
  await expect(page.getByTestId('autosave-status')).not.toHaveText(/Error/i);

  // Los inputs NO están disabled (porra abierta).
  await expect(page.getByTestId('gm-local-1')).not.toBeDisabled();
  await expect(page.getByTestId('gm-visitante-1')).not.toBeDisabled();
});

// ---------------------------------------------------------------------------
// Test 2: Happy path "rellenar y guardar"
// ---------------------------------------------------------------------------
test('grupos – rellenar un partido completo, autosave muestra "Guardado", persiste tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Rellenar el partido 1 (local 2, visitante 1).
  await page.getByTestId('gm-local-1').fill('2');
  await page.getByTestId('gm-visitante-1').fill('1');

  // Esperar a que el autosave (debounce 800ms + red) confirme el guardado.
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Recargar la página — el server component debe devolver los datos persistidos.
  await page.reload();
  await expect(page.getByTestId('gm-local-1')).toHaveValue('2');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('1');
});

// ---------------------------------------------------------------------------
// Test 3: Autosave parcial
// ---------------------------------------------------------------------------
test('grupos – autosave parcial: solo se guardan los partidos con ambos goles rellenos', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Rellenar el partido 1 (completo).
  await page.getByTestId('gm-local-1').fill('1');
  await page.getByTestId('gm-visitante-1').fill('0');

  // Rellenar solo el gol local del partido 2 (incompleto — falta visitante).
  await page.getByTestId('gm-local-2').fill('3');

  // Esperar a que el autosave confirme. Solo el partido 1 (completo) debe guardarse.
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Recargar y verificar que el partido 1 persiste pero el partido 2 no.
  await page.reload();
  await expect(page.getByTestId('gm-local-1')).toHaveValue('1');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('0');
  // El partido 2 estaba incompleto; no se guardó nada de él.
  await expect(page.getByTestId('gm-local-2')).toHaveValue('');
  await expect(page.getByTestId('gm-visitante-2')).toHaveValue('');
});

// ---------------------------------------------------------------------------
// Test 4: Validación de input — valor fuera de rango no dispara guardado
// ---------------------------------------------------------------------------
test('grupos – valor inválido: goles negativos NO persisten tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Intentar introducir -1 en el campo de goles.
  // El input tiene min=0 y type="number". Chrome sanitiza el valor a "" cuando
  // está fuera de rango, o el componente lo filtra en toEntries() antes de
  // llamar a la Server Action. En cualquier caso, el valor inválido no debe
  // persistirse en la BD.
  const input = page.getByTestId('gm-local-1');
  await input.fill('-1');

  // Esperar a que el autosave termine (debounce 800ms + respuesta del servidor).
  await page.waitForTimeout(2500);

  // Independientemente del texto del indicador (puede decir "Guardado" si se
  // envió un batch vacío con éxito), lo importante es que el valor NO persiste
  // en la BD. El comportamiento correcto: un batch vacío o sin el partido
  // inválido no genera fila en predictions_group_matches.
  await page.reload();

  // Tras recargar desde el server component, el campo debe seguir vacío.
  await expect(page.getByTestId('gm-local-1')).toHaveValue('');

  // El visitante tampoco debe tener valor (nunca se llenó).
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('');
});

// ---------------------------------------------------------------------------
// Test 5: Estado bloqueado
// Ver tests/e2e/porra-grupos-locked.spec.ts (project=locked).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test 6: Persistencia entre tabs
// ---------------------------------------------------------------------------
test('grupos – persistencia entre tabs: datos del tab Grupos sobreviven al cambio de tab y vuelta', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Rellenar partido 1.
  await page.getByTestId('gm-local-1').fill('2');
  await page.getByTestId('gm-visitante-1').fill('2');

  // Esperar confirmación de guardado.
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Navegar a otro tab (Mejores Terceros).
  await page.getByTestId('porra-tab-mejores-terceros').click();
  await expect(page.getByTestId('porra-panel-mejores-terceros')).toBeVisible();

  // Volver al tab Grupos.
  await page.getByTestId('porra-tab-grupos').click();
  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Los valores deben mantenerse en el estado local del componente.
  await expect(page.getByTestId('gm-local-1')).toHaveValue('2');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('2');
});

// ---------------------------------------------------------------------------
// Test 7 (MAYOR 1): vaciar un marcador guardado lo elimina en BD
// ---------------------------------------------------------------------------
test('grupos – vaciar un marcador previamente guardado lo elimina tras recarga', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);
  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // Guardar el marcador del partido 1 y confirmar que persiste.
  await page.getByTestId('gm-local-1').fill('2');
  await page.getByTestId('gm-visitante-1').fill('1');
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });
  await page.reload();
  await expect(page.getByTestId('gm-local-1')).toHaveValue('2');

  // Vaciar ambos campos: el batch deja de incluir el partido 1 → la fila se borra.
  await page.getByTestId('gm-local-1').fill('');
  await page.getByTestId('gm-visitante-1').fill('');
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 6000,
  });

  // Tras recargar, el marcador ya no reaparece (antes el upsert dejaba el 2–1).
  await page.reload();
  await expect(page.getByTestId('gm-local-1')).toHaveValue('');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('');
});
