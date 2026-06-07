/**
 * Helpers de espera del autosave reutilizables en los tests e2e.
 * No modifican código de producción.
 */
import { expect, type Page } from '@playwright/test';

/**
 * Espera a que el autosave complete UN NUEVO ciclo para el indicador `testId`.
 *
 * El problema: toHaveText('Guardado') matchea inmediatamente si la UI ya muestra
 * "Guardado" de un save previo, antes de que el debounce del nuevo save haya
 * disparado (AUTOSAVE_DEBOUNCE_MS = 800 ms).
 *
 * Solución: si el estado actual ya es "Guardado", esperamos a que cambie (a
 * "Guardando…" durante la SA o incluso a "Sin cambios" si el componente se
 * desmontó/remontó) y solo entonces esperamos el nuevo "Guardado".
 */
export async function waitForFreshSave(page: Page, testId: string): Promise<void> {
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
  await expect(page.getByTestId(testId)).toHaveText('Guardado', { timeout: 6000 });
}
