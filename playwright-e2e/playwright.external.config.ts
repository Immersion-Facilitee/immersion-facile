import { defineConfig, devices } from "@playwright/test";
import { frontPort, makeBackWebServerEnv } from "./e2e-env";
import config from "./playwright.config";

const baseURL = `http://localhost:${frontPort}`;
const servers = config.webServer;
if (!Array.isArray(servers)) throw new Error("Expected E2E web servers");

export default defineConfig({
  ...config,
  testDir: "./external-tests",
  workers: 1,
  retries: 0,
  use: { ...config.use, baseURL, trace: "retain-on-failure" },
  projects: [{ name: "external-siret", use: devices["Desktop Chrome"] }],
  webServer: [
    {
      ...servers[0],
      reuseExistingServer: false,
      env: makeBackWebServerEnv(baseURL, "ANNUAIRE_DES_ENTREPRISES"),
    },
    { ...servers[1], reuseExistingServer: false },
  ],
});
