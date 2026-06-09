import { expect, test } from '@playwright/test';

import { loginAsAdmin, uniqueSuffix } from '../fixtures/auth-helpers';

test('admin genera invitación y aparece en la lista sin exponer el token', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAsAdmin(page);

  await page.goto('/admin/invitaciones');
  const note = `e2e-${uniqueSuffix()}`;
  await page.fill('input[name="note"]', note);
  await page.getByRole('button', { name: /generar/i }).click();

  const url = await page.getByTestId('invitation-url').innerText();
  expect(url).toContain('/registro?token=');
  const token = new URL(url).searchParams.get('token') ?? '';
  expect(token.length).toBeGreaterThan(10);

  // Al recargar, el enlace de un solo uso desaparece pero la fila permanece,
  // identificada por su nota y SIN el token (CLAUDE.md §6).
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.locator('body')).not.toContainText(token);

  await ctx.close();
});

test('admin introduce el marcador de un partido de grupos y se persiste', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAsAdmin(page);

  await page.goto('/admin/partidos');
  const row = page.getByTestId('match-row-1');
  await row.locator('input[name="golesLocal"]').fill('2');
  await row.locator('input[name="golesVisitante"]').fill('0');
  await row.getByRole('button', { name: /guardar/i }).click();
  await expect(page.getByTestId('match-saved-1')).toBeVisible();

  // Persistencia: tras recargar, el partido queda 'finished' con el marcador.
  await page.reload();
  await expect(page.getByTestId('match-status-1')).toHaveText('finished');
  await expect(
    page.getByTestId('match-row-1').locator('input[name="golesLocal"]'),
  ).toHaveValue('2');

  await ctx.close();
});

test('acceso a /admin/partidos sin sesión redirige a /login', async ({ page }) => {
  await page.goto('/admin/partidos');
  await expect(page).toHaveURL(/\/login/);
});
