import { existsSync, readFileSync } from 'node:fs';

import { defineConfig } from '@playwright/test';

// Load .env.local into the test process so that createAdminSession / createUnlockSession
// use the same SESSION_SIGNING_SECRET as the running server.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

// CI / no-.env.local fallbacks — must match webServer.env below.
process.env.SESSION_SIGNING_SECRET ??= 'playwright-session-secret';
process.env.ADMIN_PIN ??= '123456';

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export default defineConfig({
  testDir: './tests/acceptance',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET,
      ADMIN_PIN: process.env.ADMIN_PIN,
    },
  },
});
