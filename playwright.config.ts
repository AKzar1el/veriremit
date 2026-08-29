import { defineConfig, devices } from '@playwright/test';

const e2eDataDir = `.data/e2e-${process.pid}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
  webServer: [
    {
      command: 'npm run dev --workspace @veriremit/agent',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: '8787',
        VERIREMIT_DATA_DIR: e2eDataDir,
        VERIREMIT_PROVIDER_MODE: 'fixture',
        VERIREMIT_LOGGER: 'false',
      },
    },
    {
      command: 'npm run dev --workspace @veriremit/web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env },
    },
  ],
});
