import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: [
    {command:'npm run dev -- --port 5175 --strictPort',url:'http://127.0.0.1:5175',env:{VITE_ENABLE_DEMO:'true',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',VITE_SUPABASE_ANON_KEY:''},reuseExistingServer:false},
    {command:'npm run preview -- --port 4175 --strictPort',url:'http://127.0.0.1:4175',reuseExistingServer:false},
  ],
  use: {
    baseURL: 'http://127.0.0.1:5175',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
