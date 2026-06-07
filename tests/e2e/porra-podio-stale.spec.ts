/**
 * Tests del manejo de stale (desincronización podio vs bracket) del tab Podio
 * (sub-slice 4.6).
 *
 * La lógica de detección vive en lib/validators/cross-tab.ts:
 *   analyzePodiumBracketMismatch(saved, deduction) → PodiumMismatch[]
 *
 * El componente podio-tab.tsx renderiza por cada mismatch:
 *   - data-testid="podio-mismatch-{kind}"  → aviso amber
 *   - data-testid="podio-sync-{kind}"      → botón "Sincronizar con bracket"
 *
 * Estos tests requieren un estado previo de bracket que cause desincronización.
 * Hasta que el tab de bracket (sub-slice 4.5) exista con UI completa, los
 * escenarios que necesitan manipular predictions_knockout se marcan test.skip.
 *
 * STALE-1  Sin bracket → no hay mismatches, no aparecen avisos de sync.
 * STALE-2  Podio guardado, cambia bracket → aviso de mismatch visible por puesto.
 *          (skip hasta 4.5)
 * STALE-3  Click "Sincronizar con bracket" en un campo → actualiza ese campo,
 *          autosave, persiste. Los otros campos no se tocan.
 *          (skip hasta 4.5)
 * STALE-4  Los 3 puestos stale → 3 avisos y 3 botones independientes.
 *          (skip hasta 4.5)
 * STALE-5  Indicador de completitud del tab marca "revisar" (no "completo")
 *          mientras hay mismatch, aunque los 3 campos tengan valor. ACTIVO:
 *          siembra el ganador de la final en BD para forzar un mismatch sin
 *          necesidad del tab de bracket (4.5).
 *
 * El stepper decide "revisar" con el mapa podium.mismatches que computa
 * load-podium.ts server-side (analyzePodiumBracketMismatch), la misma función
 * pura que usa el PodioTab para sus avisos: una sola fuente de verdad.
 */
import { expect, test } from '@playwright/test';

import { registerAndLand, registerAndLandIdentity } from '../fixtures/auth-helpers';
import { seedKnockoutWinner } from '../fixtures/knockout-helpers';
import { gotoPodio, pickPodio, podioTeamCodes } from '../fixtures/podio-helpers';

// ---------------------------------------------------------------------------
// STALE-1: Sin bracket → no aparecen avisos de mismatch
// ---------------------------------------------------------------------------
test('podio stale-1 – sin bracket, no hay avisos de desincronización visibles', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  await gotoPodio(page);

  // Sin bracket no hay deducción → analyzePodiumBracketMismatch devuelve []
  // → ningún aviso de desincronización debe ser visible.
  await expect(page.getByTestId('podio-mismatch-champion')).not.toBeVisible();
  await expect(page.getByTestId('podio-mismatch-runnerUp')).not.toBeVisible();
  await expect(page.getByTestId('podio-mismatch-third')).not.toBeVisible();

  // Tampoco deben existir los botones "Sincronizar".
  await expect(page.getByTestId('podio-sync-champion')).not.toBeVisible();
  await expect(page.getByTestId('podio-sync-runnerUp')).not.toBeVisible();
  await expect(page.getByTestId('podio-sync-third')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// STALE-2..4: Requieren bracket previo — skipped hasta 4.5
// ---------------------------------------------------------------------------

test.skip(
  'podio stale-2 – podio guardado con champion=MEX, bracket cambia winner a USA → aviso de mismatch en champion',
  // TODO: enable en 4.5. Flujo:
  //   1. Registrar usuario.
  //   2. Guardar champion=MEX en podio vía UI.
  //   3. Crear/cambiar predictions_knockout final→USA (vía tab 4.5 o endpoint de test).
  //   4. Recargar /porra y abrir tab Podio.
  //   5. El aviso "podio-mismatch-champion" está visible.
  //   6. El texto dice "No coincide con tu predicción del bracket (USA)."
  //   7. El botón "Sincronizar" está visible.
  //   8. El campo champion en BD sigue siendo MEX (no se ha sobrescrito).
  async () => {},
);

test.skip(
  'podio stale-3 – click en "Sincronizar con bracket" del campeón actualiza solo champion, el resto intacto',
  // TODO: enable en 4.5.
  // Tras el click en podio-sync-champion:
  //   - El select champion pasa a mostrar el valor del bracket.
  //   - El autosave dispara (esperar indicador "Guardado").
  //   - El aviso podio-mismatch-champion desaparece.
  //   - runnerUp y third no cambian (aunque también estén stale).
  async () => {},
);

test.skip(
  'podio stale-4 – los 3 puestos stale → 3 avisos y 3 botones "Sincronizar" independientes',
  // TODO: enable en 4.5.
  // Setup: podio guardado con valores A, B, C. Bracket apunta a X, Y, Z (distintos).
  // Resultado: podio-mismatch-champion, podio-mismatch-runnerUp, podio-mismatch-third
  //            todos visibles. El usuario puede sincronizar uno, dos o los tres.
  async () => {},
);

// ---------------------------------------------------------------------------
// STALE-5: Indicador de completitud con mismatch → "revisar" (no "completo")
// ---------------------------------------------------------------------------

test('podio stale-5 – con los 3 campos llenos pero un puesto desincronizado, el tab marca "revisar"', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);

  await gotoPodio(page);

  // 4 equipos distintos (los options solo existen con el panel montado): A/B/C
  // van al podio; D es el campeón que dice el bracket.
  const [a, b, c, d] = await podioTeamCodes(page, 4);

  // El bracket predice campeón = D (ganador de la final). Se siembra en BD porque
  // el tab de eliminatorias (4.5) aún no existe.
  await seedKnockoutWinner(email, 'final', d);

  // El usuario rellena los 3 puestos con A/B/C (champion = A ≠ D → desincronizado).
  await pickPodio(page, 'champion', a);
  await pickPodio(page, 'runnerUp', b);
  await pickPodio(page, 'third', c);

  // El stepper recalcula la completitud desde el snapshot de servidor: recargar.
  await page.reload();

  // Los 3 campos tienen valor PERO el campeón no coincide con el bracket → el
  // indicador del tab debe ser "revisar", no "completo".
  await expect(page.getByTestId('porra-tab-mark-podio')).toHaveAttribute(
    'aria-label',
    'revisar',
  );

  // Y el aviso de desincronización del campeón apunta al equipo del bracket (D),
  // mientras el valor guardado sigue siendo el del usuario (A).
  await page.getByTestId('porra-tab-podio').click();
  await expect(page.getByTestId('podio-mismatch-champion')).toBeVisible();
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(a);
});
