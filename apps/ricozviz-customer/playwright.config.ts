import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
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
  webServer: [
    {
      command: 'node dist/index.js',
      cwd: '../backend',
      port: 4000,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ricozviz_customer_test',
        NODE_ENV: 'test',
        PORT: '4000'
      }
    },
    {
      command: 'next start --port 3001',
      port: 3001,
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ricozviz_customer_test',
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000'
      }
    }
  ]
});
