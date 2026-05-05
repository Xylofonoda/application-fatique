import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the application-fatique E2E test suite.
 *
 * Tests are split into two projects:
 *  - "chromium" – main browser (headed in dev so you can watch form-filling)
 *  - "setup"    – auth setup that runs before E2E tests
 *
 * The dev server is auto-started if not already running.
 *
 * Environment variables:
 *   BASE_URL        – defaults to http://localhost:3000
 *   TEST_EMAIL      – email for test login (if credentials provider added)
 *   CI              – set to '1' for headless CI runs
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,        // per-test timeout — scraping can take >30s
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["./tests/e2e/reporters/fixPlanReporter.ts"],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: !!process.env.CI,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.SKIP_DEV_SERVER
    ? undefined
    : {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
});
