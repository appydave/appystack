import { test, expect } from '@playwright/test';

// The client and server are started by playwright.config.ts (webServer).

test('the landing page renders', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText(/Production-ready RVETS stack boilerplate/)).toBeVisible();
});

test('at least one status card is visible', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('status-grid')).toBeVisible();
});

test('/health answers through the client proxy', async ({ request }) => {
  const res = await request.get('/health');

  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok' });
});
