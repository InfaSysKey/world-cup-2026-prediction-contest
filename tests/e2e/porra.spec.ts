import { expect, test, type Browser, type Page } from '@playwright/test';

import { PORRA_TABS } from '@/lib/constants';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

async function adminGenerateInvitationUrl(browser: Browser): Promise<string> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL('**/porra');
  await page.goto('/admin/invitaciones');
  await page.getByRole('button', { name: /generar/i }).click();
  const url = await page.getByTestId('invitation-url').innerText();
  await ctx.close();
  return url;
}

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// Registra un usuario nuevo (no admin) y deja la página en /porra.
async function registerAndLand(browser: Browser): Promise<Page> {
  const url = await adminGenerateInvitationUrl(browser);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'Porra');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', `e2e_${suffix}@test.dev`);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();
  await page.waitForURL('**/porra');
  return page;
}

test('usuario logueado ve el stepper con todos los tabs', async ({ browser }) => {
  const page = await registerAndLand(browser);

  await expect(page.getByTestId('porra-stepper')).toBeVisible();
  await expect(page.getByTestId('porra-banner')).toContainText('PORRA INCOMPLETA');

  for (const tab of PORRA_TABS) {
    await expect(page.getByTestId(`porra-tab-${tab.id}`)).toBeVisible();
  }

  // El primer tab está activo por defecto.
  await expect(page.getByTestId(`porra-panel-${PORRA_TABS[0].id}`)).toBeVisible();
});

test('el usuario puede navegar entre tabs', async ({ browser }) => {
  const page = await registerAndLand(browser);

  await page.getByTestId('porra-tab-mejores-terceros').click();
  await expect(
    page.getByTestId('porra-panel-mejores-terceros'),
  ).toBeVisible();

  await page.getByTestId('porra-tab-final').click();
  await expect(page.getByTestId('porra-panel-final')).toBeVisible();
});
