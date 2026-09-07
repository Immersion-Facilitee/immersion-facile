import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { e2eBackendEnv } from "./e2e-env";

const CONTAINER_STATE_FILE = resolve(__dirname, ".container-state.json");
const ROOT_DIR = resolve(__dirname, "..");

type ContainerState = {
  containerId: string;
  connectionUri: string;
  host: string;
  port: number;
};

export const readContainerState = (): ContainerState | undefined => {
  if (!existsSync(CONTAINER_STATE_FILE)) return undefined;
  try {
    return JSON.parse(readFileSync(CONTAINER_STATE_FILE, "utf-8"));
  } catch (error) {
    console.warn("Invalid E2E container state file, deleting it.", error);
    rmSync(CONTAINER_STATE_FILE);
    return undefined;
  }
};

export const isContainerRunning = (containerId: string): boolean => {
  try {
    const result = execFileSync(
      "docker",
      ["inspect", "--format={{.State.Running}}", containerId],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    return result === "true";
  } catch {
    return false;
  }
};

export const stopAndCleanup = (state: ContainerState | undefined) => {
  if (!state) {
    console.log("No container state found, nothing to stop.");
    return;
  }
  stopContainer(state.containerId);
  if (existsSync(CONTAINER_STATE_FILE)) rmSync(CONTAINER_STATE_FILE);
};

const stopContainer = (containerId: string) => {
  try {
    console.log(`Stopping container ${containerId}...`);
    execFileSync("docker", ["rm", "-f", "-v", containerId], {
      stdio: "ignore",
    });
    console.log("Container stopped.");
  } catch {
    console.log("Container already gone.");
  }
};

const runWithBackendEnv = (scriptName: string, connectionUri: string) =>
  execFileSync("pnpm", [scriptName], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      ...e2eBackendEnv,
      DATABASE_URL: connectionUri,
    },
    stdio: "inherit",
  });

const runMigrations = (connectionUri: string) => {
  console.log("Running migrations...");
  console.time("migrations");
  runWithBackendEnv("db:up:bun", connectionUri);
  console.timeEnd("migrations");
};

const runSeed = (connectionUri: string) => {
  console.log("Running seed...");
  console.time("seed");
  runWithBackendEnv("db:seed:bun", connectionUri);
  console.timeEnd("seed");
};

export const startFreshContainer = async (): Promise<{
  connectionUri: string;
  containerId: string;
}> => {
  console.log("Starting PostgreSQL testcontainer for E2E tests...");
  console.time("container-start");

  const container = await new PostgreSqlContainer("postgis/postgis:13-master")
    .withDatabase("immersion-db")
    .withUsername("immersion")
    .withPassword("password")
    .withStartupTimeout(120000)
    .start();

  const connectionUri = container.getConnectionUri();
  const containerId = container.getId();
  console.timeEnd("container-start");
  console.log(`PostgreSQL container started: ${connectionUri}`);

  writeFileSync(
    CONTAINER_STATE_FILE,
    JSON.stringify({
      containerId,
      connectionUri,
      host: container.getHost(),
      port: container.getPort(),
    }),
  );

  runMigrations(connectionUri);
  runSeed(connectionUri);

  return { connectionUri, containerId };
};

export const cleanupContainer = (containerId: string) => {
  stopContainer(containerId);
  if (existsSync(CONTAINER_STATE_FILE)) rmSync(CONTAINER_STATE_FILE);
};

export const getDevModeConnectionUri = async ({
  reset,
}: {
  reset: boolean;
}): Promise<string> => {
  const existingState = readContainerState();
  const canReuse =
    !reset &&
    existingState !== undefined &&
    isContainerRunning(existingState.containerId);

  if (canReuse) {
    console.log(`Reusing existing container ${existingState.containerId}`);
    runSeed(existingState.connectionUri);
    return existingState.connectionUri;
  }

  if (existingState) stopAndCleanup(existingState);
  const fresh = await startFreshContainer();
  return fresh.connectionUri;
};
