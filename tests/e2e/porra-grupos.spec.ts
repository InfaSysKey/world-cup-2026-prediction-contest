import { expect, test, type Browser, type Page } from '@playwright/test';

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

async function registerAndLand(browser: Browser): Promise<Page> {
  const url = await adminGenerateInvitationUrl(browser);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'Grupos');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', `e2e_${suffix}@test.dev`);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();
  await page.waitForURL('**/porra');
  return page;
}

test('rellenar un marcador dispara autosave y persiste tras recargar', async ({
  browser,
}) => {
  const page = await registerAndLand(browser);

  // El tab Grupos está activo por defecto.
  await expect(page.getByTestId('group-matches-tab')).toBeVisible();

  // El primer partido del catálogo (id 1) está en el grupo A.
  await page.getByTestId('gm-local-1').fill('3');
  await page.getByTestId('gm-visitante-1').fill('1');

  // El autosave (debounce 800ms) acaba mostrando "Guardado".
  await expect(page.getByTestId('autosave-status')).toHaveText('Guardado', {
    timeout: 5000,
  });

  // Tras recargar, el server component devuelve los datos persistidos.
  await page.reload();
  await expect(page.getByTestId('gm-local-1')).toHaveValue('3');
  await expect(page.getByTestId('gm-visitante-1')).toHaveValue('1');
});
