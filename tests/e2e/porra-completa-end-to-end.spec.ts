/**
 * Test end-to-end del resumen global de la porra (sub-slice 4.8).
 *
 * Verifica el agregado de las 5 categorías a través del sticky footer y el panel
 * de revisión. Sembramos los datos por BD (rellenar 72 marcadores + 32 cruces +
 * … por UI sería inviable en un test) y comprobamos el comportamiento observable:
 *   E2E-1  Porra completa y coherente → footer verde "PORRA COMPLETA" y el panel
 *          felicita sin inconsistencias.
 *   E2E-2  Falta un único premio → footer INCOMPLETA; al rellenarlo por UI y
 *          autoguardar, el footer pasa a verde (el summary se refresca solo).
 *   E2E-3  Un bracket incoherente con los grupos → footer REVISAR y el panel
 *          lista la inconsistencia.
 */
import { expect, test } from '@playwright/test';

import { registerAndLandIdentity } from '../fixtures/auth-helpers';
import { seedKnockoutWinner } from '../fixtures/knockout-helpers';
import {
  seedFullCoherentPorra,
  seedStandingsAndThirds,
} from '../fixtures/standings-helpers';
import { waitForFreshSave } from '../fixtures/wait-helpers';

test('e2e-1 – porra completa coherente: footer verde y panel sin inconsistencias', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedFullCoherentPorra(email);
  await page.reload();

  const footer = page.getByTestId('porra-sticky-footer');
  await expect(footer).toHaveAttribute('data-state', 'completa');
  await expect(footer).toContainText('Álbum completo');

  await footer.click();
  await expect(page.getByTestId('porra-review-panel')).toBeVisible();
  await expect(page.getByTestId('porra-review-complete')).toBeVisible();
});

test('e2e-2 – rellenar el último hueco pasa el footer a verde', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedFullCoherentPorra(email, { omitBallBronze: true });
  await page.reload();

  const footer = page.getByTestId('porra-sticky-footer');
  await expect(footer).toHaveAttribute('data-state', 'incompleta');
  await expect(footer).toContainText('Te faltan');

  await page.getByTestId('porra-tab-premios').click();
  await page.getByTestId('premios-input-ballBronze').fill('Crack 3');
  await waitForFreshSave(page, 'premios-autosave-status');

  await expect(footer).toHaveAttribute('data-state', 'completa');
  await expect(footer).toContainText('Álbum completo');
});

test('e2e-3 – bracket incoherente con los grupos: footer REVISAR y panel lo lista', async ({
  browser,
}) => {
  const { page, email } = await registerAndLandIdentity(browser);
  await seedStandingsAndThirds(email);
  // seedStandingsAndThirds ordena cada grupo por code; el grupo A del seed es
  // CZE/KOR/MEX/ZAF, así que ZAF queda 4.º (no clasifica). Predecimos que ZAF
  // gana la final → inconsistencia bracket↔grupos.
  await seedKnockoutWinner(email, 'final', 'ZAF');
  await page.reload();

  const footer = page.getByTestId('porra-sticky-footer');
  // Hay huecos (casi toda la porra) Y una inconsistencia → estado combinado.
  await expect(footer).toHaveAttribute('data-state', 'mixta');

  await footer.click();
  await expect(page.getByTestId('porra-review-panel')).toBeVisible();
  await expect(
    page.getByTestId('porra-review-mismatch-bracket.unqualified.104.ZAF'),
  ).toBeVisible();
});
