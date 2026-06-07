/**
 * Tests del prefill server-side del tab Podio (sub-slice 4.6).
 *
 * La lógica de prefill vive en app/(porra)/porra/load-podium.ts:
 *   - Si el usuario NO tiene ninguna fila en predictions_awards (kinds
 *     champion/runner_up/third) Y hay algo deducible del bracket → se inserta.
 *   - Si ya existe al menos UNA fila → nunca se vuelve a auto-rellenar.
 *
 * Estos tests comprueban la lógica observable desde la UI: qué valores muestran
 * los selects al cargar la página según el estado previo del bracket.
 *
 * IMPORTANTE: El tab de bracket eliminatorio no existe todavía en la UI (sub-
 * slice 4.5 es placeholder). Estos tests insertan directamente en
 * predictions_knockout via la API de test para crear el estado previo de bracket,
 * o bien verifican escenarios desde un usuario sin bracket (el caso por defecto).
 *
 * Sub-casos:
 *   PREFILL-1  Sin bracket previo → 3 selects vacíos, hints "Sin predicción".
 *   PREFILL-2  Usuario con bracket completo y coherente → 3 selects pre-rellenos.
 *   PREFILL-3  Solo final predicha (sin semis, sin 3-4) → solo champion pre-relleno.
 *   PREFILL-4  Final + 2 semis, sin 3-4 → champion y runnerUp pre-rellenos, third vacío.
 *   PREFILL-5  Bracket incoherente (campeón no en semis) → champion se prefilla,
 *              runnerUp vacío. Documenta comportamiento real de deducePodium.
 *   PREFILL-6  Usuario con podio ya guardado cambia el bracket → el podio NO se
 *              sobreescribe al recargar (prefill solo en primer acceso).
 *
 * Los escenarios PREFILL-2..6 requieren insertar filas en predictions_knockout
 * antes de cargar /porra. Hasta que el tab de bracket exista con UI completa,
 * estos tests se marcan como test.skip con el motivo documentado: no hay forma
 * de crear el estado previo de bracket a través de la UI.
 *
 * PREFILL-1 sí corre porque es el estado natural de un usuario recién registrado
 * (ya cubierto parcialmente en porra-podio.spec.ts; este test es más explícito
 * sobre los hints).
 */
import { expect, test } from '@playwright/test';

import { registerAndLand } from '../fixtures/auth-helpers';

// ---------------------------------------------------------------------------
// PREFILL-1: Sin bracket → selects vacíos, hints "Necesitas predecir …"
// ---------------------------------------------------------------------------
test('podio prefill-1 – sin bracket previo, los 3 selects arrancan vacíos y los hints lo indican', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('porra-panel-podio')).toBeVisible();
  await expect(page.getByTestId('podio-tab')).toBeVisible();

  // Los selects no tienen valor seleccionado (valor vacío = placeholder).
  await expect(page.getByTestId('podio-select-champion')).toHaveValue('');
  await expect(page.getByTestId('podio-select-runnerUp')).toHaveValue('');
  await expect(page.getByTestId('podio-select-third')).toHaveValue('');

  // Los hints informan QUÉ falta predecir en el bracket para derivar cada puesto.
  await expect(page.getByTestId('podio-hint-champion')).toContainText(
    'Necesitas predecir la final para deducir el campeón',
  );
  await expect(page.getByTestId('podio-hint-runnerUp')).toContainText(
    'Necesitas predecir las 2 semifinales y la final para deducir el subcampeón',
  );
  await expect(page.getByTestId('podio-hint-third')).toContainText(
    'Necesitas predecir el partido por el 3.º puesto para deducir el 3.º',
  );
});

// ---------------------------------------------------------------------------
// PREFILL-2..6: Requieren bracket previo insertado vía DB — skipped hasta 4.5
// ---------------------------------------------------------------------------

test.skip(
  'podio prefill-2 – bracket completo y coherente → 3 selects pre-rellenos al cargar',
  // TODO: enable cuando el tab de bracket (4.5) permita crear este estado
  // vía UI. Alternativamente, exponer un endpoint de test para insertar
  // predictions_knockout directamente.
  async () => {
    // Setup esperado:
    //   predictions_knockout: semi→ESP, semi→FRA, final→ESP, 3-4→POR
    // Al cargar /porra sin ninguna fila previa en predictions_awards:
    //   champion = ESP, runnerUp = FRA, third = POR
    // Y esos valores aparecen en los selects al abrir el tab Podio.
  },
);

test.skip(
  'podio prefill-3 – solo final predicha (sin semis ni 3-4) → solo champion se pre-rellena',
  // TODO: enable en 4.5. El campeón se deduce de la fase 'final'.
  // runnerUp y third siguen vacíos (no hay datos para deducirlos).
  async () => {
    // Setup: predictions_knockout → solo { phase: 'final', winner: 'BRA' }
    // Resultado esperado en selects: champion='BRA', runnerUp='', third=''
    // Hint de runnerUp: 'Sin predicción de la final todavía'
    // (subcampeón requiere 2 semis y que el campeón figure en ellas)
  },
);

test.skip(
  'podio prefill-4 – final + 2 semis, sin 3-4 → champion y runnerUp pre-rellenos, third vacío',
  // TODO: enable en 4.5.
  // Setup: semi→ESP, semi→FRA, final→ESP (sin 3-4)
  // Resultado: champion='ESP', runnerUp='FRA', third=''
  async () => {},
);

test.skip(
  'podio prefill-5 – bracket incoherente (campeón no es ganador de ninguna semi) → champion se prefilla, runnerUp vacío',
  // TODO: enable en 4.5. Documenta comportamiento real de deducePodium:
  //   - champion = ganador de 'final' sin comprobaciones de coherencia.
  //   - runnerUp = null porque champion no figura en semiWinners.
  // Esto NO diverge de scoring-rules.md §2.6: el bracket es rígido y la
  // deducción no está obligada a validar consistencia entre fases.
  async () => {
    // Setup: semi→ESP, semi→FRA, final→BRA (BRA no ganó ninguna semi)
    // Resultado: champion='BRA', runnerUp='', third=''
  },
);

test.skip(
  'podio prefill-6 – usuario con podio ya guardado cambia el bracket → el podio NO se sobreescribe',
  // TODO: enable en 4.5. Regla crítica: prefill solo al primer acceso.
  // Una vez existe al menos 1 fila en predictions_awards (kinds de podio),
  // loadPodium() no vuelve a insertar aunque el bracket cambie.
  // Flujo:
  //   1. Crear usuario, abrir /porra, elegir champion manualmente (1 fila en BD).
  //   2. Cambiar el bracket (vía UI de 4.5) para que apunte a otro campeón.
  //   3. Recargar /porra.
  //   4. El select champion sigue mostrando el valor del paso 1.
  async () => {},
);
