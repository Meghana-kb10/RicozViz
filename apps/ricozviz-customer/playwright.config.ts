import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'next start --port 3001',
    port: 3001,
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      MONGODB_URI: 'mongodb://127.0.0.1:27017/ricozviz_customer_test',
      NODE_ENV: 'test'
    }
  }
});
