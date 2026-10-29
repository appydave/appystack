import { defineConfig } from '@playwright/test';

const CLIENT_PORT = 5500;
const SERVER_PORT = 5501;
const SECOND = 1000;
const TEST_TIMEOUT_SECONDS = 60;
const STARTUP_TIMEOUT_SECONDS = 120;

// Playwright starts the dev server and client itself and stops them afterwards. Locally it reuses
// ones that are already running; in CI it always starts its own.
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: TEST_TIMEOUT_SECONDS * SECOND,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    baseURL: `http://localhost:${CLIENT_PORT}`,
  },
  webServer: [
    {
      command: 'npm run dev -w server',
      url: `http://localhost:${SERVER_PORT}/health`,
      reuseExistingServer,
      timeout: STARTUP_TIMEOUT_SECONDS * SECOND,
    },
    {
      command: 'npm run dev -w client',
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer,
      timeout: STARTUP_TIMEOUT_SECONDS * SECOND,
    },
  ],
});
