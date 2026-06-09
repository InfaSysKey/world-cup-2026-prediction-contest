/**
 * Helpers de autenticación reutilizables en los tests e2e.
 * No modifican código de producción.
 */
import type { Browser, Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';

export async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL('**/porra');
}

export async function adminGenerateInvitationUrl(
  browser: Browser,
): Promise<string> {
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

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Registra un nuevo usuario a través del flujo de invitación y devuelve la
 * página ya en /porra junto con el email usado (clave para localizar al usuario
 * en BD desde fixtures de semilla). El contexto del browser queda abierto para
 * que el test pueda seguir interactuando.
 */
export async function registerAndLandIdentity(
  browser: Browser,
): Promise<{ page: Page; email: string }> {
  const url = await adminGenerateInvitationUrl(browser);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const suffix = uniqueSuffix();
  const email = `e2e_${suffix}@test.dev`;

  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.fill('input[name="nombre"]', 'E2E');
  await page.fill('input[name="apellidos"]', 'Grupos');
  await page.fill('input[name="nickname"]', `e2e_${suffix}`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'password123');
  await page.getByRole('button', { name: /crear/i }).click();
  await page.waitForURL('**/porra');
  return { page, email };
}

/**
 * Igual que registerAndLandIdentity pero devolviendo solo la página, que es lo
 * que necesita la mayoría de los tests.
 */
export async function registerAndLand(browser: Browser): Promise<Page> {
  const { page } = await registerAndLandIdentity(browser);
  return page;
}
