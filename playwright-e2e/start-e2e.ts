import { resolve } from "node:path";
import dotEnv from "dotenv";
import { parseE2eArgs } from "./e2e-args";
import {
  cleanupContainer,
  getDevModeConnectionUri,
  readContainerState,
  startFreshContainer,
  stopAndCleanup,
} from "./e2e-container";
import { ensureSecretsEnv } from "./e2e-env";
import { runPlaywright } from "./e2e-playwright";

dotEnv.config({ path: resolve(__dirname, ".env"), override: true });

const main = async () => {
  process.env.TESTCONTAINERS_REUSE_ENABLE = "false";
  process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
  ensureSecretsEnv();

  const { flags, playwrightArgs } = parseE2eArgs(process.argv.slice(2));

  if (flags.stop) {
    stopAndCleanup(readContainerState());
    return;
  }

  if (flags.dev) {
    const connectionUri = await getDevModeConnectionUri({ reset: flags.reset });

    runPlaywright(connectionUri, playwrightArgs, (code) => process.exit(code));

    process.on("SIGINT", () => {
      console.log("\nReceived SIGINT (dev mode: container kept alive)");
      process.exit(1);
    });
    process.on("SIGTERM", () => {
      console.log("\nReceived SIGTERM (dev mode: container kept alive)");
      process.exit(1);
    });
    return;
  }

  stopAndCleanup(readContainerState());
  const { connectionUri, containerId } = await startFreshContainer();
  const cleanup = () => cleanupContainer(containerId);

  runPlaywright(connectionUri, playwrightArgs, (code) => {
    cleanup();
    process.exit(code);
  });

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, cleaning up...");
    cleanup();
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, cleaning up...");
    cleanup();
    process.exit(1);
  });
};

main().catch((err) => {
  console.error("E2E setup failed:", err);
  process.exit(1);
});
