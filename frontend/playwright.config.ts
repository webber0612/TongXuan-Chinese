import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175/TongXuan-Chinese/";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "ipad-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npm run build:e2e && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
