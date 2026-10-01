import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the real interface in Chromium, over a simulated Tauri host
 * (e2e/host.ts). Every run leaves the same artifact behind:
 *
 *   e2e-report/html/index.html  the report, with a trace and a final screenshot per test
 *   e2e-report/results.json     the same results, for a machine to compare
 *   e2e-report/artifacts/       the traces and screenshots themselves
 *
 * On Windows, `npx playwright install chromium` once. Elsewhere, point
 * CHROMIUM_PATH at an existing Chromium to skip the download.
 */
const port = 5199;

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-report/artifacts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e-report/html", open: "never" }],
    ["json", { outputFile: "e2e-report/results.json" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    viewport: { width: 1280, height: 860 },
    trace: "on",
    screenshot: "on",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } }],
  webServer: {
    command: `npx vite --config apps/desktop/vite.config.ts --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
