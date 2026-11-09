// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.E2E_PORT || 4400);

/**
 * The tests run against backend/scripts/e2e-server.js: the real API on an
 * in-memory MongoDB with the demo data, serving the built frontend.
 * Build the frontend first (npx ng build in frontend/).
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /phone\.spec\.js/ },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /phone\.spec\.js/ },
  ],
  webServer: {
    command: "node ../backend/scripts/e2e-server.js",
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    env: { E2E_PORT: String(PORT) },
  },
});
