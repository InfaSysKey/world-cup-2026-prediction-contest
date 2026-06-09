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
 * Estos tests siembran el estado previo de bracket en BD con
 * seedKnockoutWinner / seedPodiumBracket (el desfase stale = podio guardado que
 * deja de coincidir con la deducción del bracket).
 *
 * STALE-1  Sin bracket → no hay mismatches, no aparecen avisos de sync.
 * STALE-2  Podio guardado, el bracket apunta a otro campeón → aviso de mismatch.
 * STALE-3  Click "Sincronizar con bracket" en un campo → actualiza ese campo,
 *          autosave, persiste. Los otros campos no se tocan.
 * STALE-4  Los 3 puestos stale → 3 avisos y 3 botones independientes.
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
import {
  seedKnockoutWinner,
  seedPodiumBracket,
} from '../fixtures/knockout-helpers';
import { gotoPodio, pickPodio, podioTeamCodes } from '../fixtures/podio-helpers';
import { waitForFreshSave } from '../fixtures/wait-helpers';

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
// STALE-2..4: bracket sembrado en BD (seedKnockoutWinner / seedPodiumBracket)
// ---------------------------------------------------------------------------

test('podio stale-2 – campeón guardado pero el bracket apunta a otro → aviso de mismatch', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await gotoPodio(page);

  // El usuario guarda champion = a por UI.
  const [a, b] = await podioTeamCodes(page, 2);
  await pickPodio(page, 'champion', a);

  // El bracket predice un campeón distinto (final → b). Se siembra en BD.
  await seedKnockoutWinner(email, 'final', b);
  await page.reload();
  await gotoPodio(page);

  // Aviso de desincronización visible y botón "Sincronizar" presente.
  const mismatch = page.getByTestId('podio-mismatch-champion');
  await expect(mismatch).toBeVisible();
  await expect(mismatch).toContainText('No coincide con tu predicción del bracket');
  await expect(page.getByTestId('podio-sync-champion')).toBeVisible();

  // El valor guardado NO se ha sobrescrito: sigue siendo a.
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(a);
});

test('podio stale-3 – "Sincronizar" del campeón actualiza solo champion, el resto intacto', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await gotoPodio(page);

  // Guardar los 3 puestos: champion = a, runnerUp = c, third = d.
  const [a, b, c, d] = await podioTeamCodes(page, 4);
  await pickPodio(page, 'champion', a);
  await pickPodio(page, 'runnerUp', c);
  await pickPodio(page, 'third', d);

  // Solo la final del bracket (→ b) desincroniza al campeón.
  await seedKnockoutWinner(email, 'final', b);
  await page.reload();
  await gotoPodio(page);

  await expect(page.getByTestId('podio-mismatch-champion')).toBeVisible();
  await page.getByTestId('podio-sync-champion').click();
  await waitForFreshSave(page, 'podio-autosave-status');

  // El campeón pasa al valor del bracket; el aviso desaparece; el resto intacto.
  await expect(page.getByTestId('podio-select-champion')).toHaveValue(b);
  await expect(page.getByTestId('podio-mismatch-champion')).not.toBeVisible();
  await expect(page.getByTestId('podio-select-runnerUp')).toHaveValue(c);
  await expect(page.getByTestId('podio-select-third')).toHaveValue(d);
});

test('podio stale-4 – los 3 puestos stale → 3 avisos y 3 botones "Sincronizar"', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await gotoPodio(page);

  // Guardar A/B/C; el bracket deducirá D/E/F (todos distintos).
  const [a, b, c, d, e, f] = await podioTeamCodes(page, 6);
  await pickPodio(page, 'champion', a);
  await pickPodio(page, 'runnerUp', b);
  await pickPodio(page, 'third', c);

  await seedPodiumBracket(email, d, e, f);
  await page.reload();
  await gotoPodio(page);

  for (const key of ['champion', 'runnerUp', 'third'] as const) {
    await expect(page.getByTestId(`podio-mismatch-${key}`)).toBeVisible();
    await expect(page.getByTestId(`podio-sync-${key}`)).toBeVisible();
  }
});

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
