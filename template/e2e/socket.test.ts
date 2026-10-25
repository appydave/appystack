import { test, expect } from '@playwright/test';

// The client and server are started by playwright.config.ts (webServer).

test('socket ping-pong flow sends ping and receives pong response', async ({ page }) => {
  await page.goto('/');

  // The Send Ping button is disabled until the socket connects.
  const sendPingButton = page.getByRole('button', { name: 'Send Ping' });

  await expect(sendPingButton).toBeEnabled();
  await sendPingButton.click();

  await expect(page.getByText(/server:pong received/)).toBeVisible();
  await expect(sendPingButton).toBeEnabled();
});
