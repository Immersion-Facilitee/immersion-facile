import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { backPort, frontPort, makeBackWebServerEnv } from "./e2e-env";

const storageStatePath = resolve(__dirname, "data/storageState.json");

/**
 * See https://playwright.dev/docs/test-configuration.
 */

const baseURL = process.env.BASE_URL || `http://localhost:${frontPort}`;
const reuseExistingServer =
  !process.env.CI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "false";

export default defineConfig({
  testDir: "./tests",
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["github"], ["html"], ["line"]] : "html",
  use: {
    baseURL,
    screenshot: {
      mode: "only-on-failure",
      fullPage: true,
    },
    storageState: storageStatePath,
    trace: "retain-on-failure",
  },
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: {
    timeout: process.env.CI ? 10_000 : 8_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "pnpm back dev:no-typecheck",
      url: `http://localhost:${backPort}`,
      reuseExistingServer,
      timeout: 120000,
      cwd: "..",
      env: makeBackWebServerEnv(baseURL),
    },
    {
      command: "pnpm front dev",
      url: baseURL,
      reuseExistingServer,
      timeout: 120000,
      cwd: "..",
      env: {
        BACKEND_PORT: backPort.toString(),
        PORT: frontPort.toString(),
        VITE_GATEWAY: "HTTP",
        VITE_ENV_TYPE: "local",
        VITE_PREFILLED_FORMS: "true",
        // VITE_CRISP_WEBSITE_ID: "test", --> Commenté car crisp pas actif en prod donc on désactive ici
        VITE_RELEASE_TAG: "v0",
      },
    },
  ],
});
