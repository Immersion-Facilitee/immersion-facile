import { generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";
import dotEnv from "dotenv";

export const frontPort = 3000;
export const backPort = 1234;

export const getProcessEnvAsStringRecord = (): Record<string, string> => {
  const processEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined) processEnv[key] = value;
  return processEnv;
};

export const loadEnvFileWithProcessEnv = (
  path: string,
): Record<string, string> => ({
  ...getProcessEnvAsStringRecord(),
  ...(dotEnv.config({ path, processEnv: {} }).parsed ?? {}),
});

export const e2eBackendEnv = {
  NODE_ENV: "local",
  NOTIFICATION_GATEWAY: "IN_MEMORY",
  ESTABLISHMENT_MARKETING_GATEWAY: "IN_MEMORY",
  ADDRESS_API_GATEWAY: "OPEN_CAGE_DATA",
  PRO_CONNECT_GATEWAY: "HTTPS",
  PRO_CONNECT_CLIENT_ID: "449e24c6-b5aa-4435-bb8c-728d4a3c1c94",
  PRO_CONNECT_BASE_URI: "https://fca.integ01.dev-agentconnect.fr/api/v2",
  POLE_EMPLOI_GATEWAY: "IN_MEMORY",
  LA_BONNE_BOITE_GATEWAY: "IN_MEMORY",
  PASS_EMPLOI_GATEWAY: "IN_MEMORY",
  PDF_GENERATOR_GATEWAY: "IN_MEMORY",
  SHORT_LINK_ID_GENERATOR_GATEWAY: "NANO_ID",
  DOMAIN: `localhost:${frontPort}`,
  REPOSITORIES: "PG",
  INBOUND_EMAIL_ALLOWED_IPS: "::ffff:127.0.0.1",
  SIRENE_REPOSITORY: "IN_MEMORY",
  EVENT_CRAWLER_PERIOD_MS: "600",
  EXTERNAL_AXIOS_TIMEOUT: "30000",
  CACHE: "NONE",
};

type JwtEnv = {
  API_JWT_PRIVATE_KEY: string;
  API_JWT_PUBLIC_KEY: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
};

const generateJwtKeyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
  });

  return { privateKey, publicKey };
};

export const ensureJwtEnv = (): JwtEnv => {
  const jwtKeyPair = generateJwtKeyPair();
  const apiJwtKeyPair = generateJwtKeyPair();

  const jwtEnv = {
    JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY ?? jwtKeyPair.privateKey,
    JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY ?? jwtKeyPair.publicKey,
    API_JWT_PRIVATE_KEY:
      process.env.API_JWT_PRIVATE_KEY ?? apiJwtKeyPair.privateKey,
    API_JWT_PUBLIC_KEY:
      process.env.API_JWT_PUBLIC_KEY ?? apiJwtKeyPair.publicKey,
  };

  Object.assign(process.env, jwtEnv);

  return jwtEnv;
};

export const makeBackWebServerEnv = (
  baseURL: string,
): Record<string, string> => {
  const jwtEnv = ensureJwtEnv();
  const playwrightEnv = loadEnvFileWithProcessEnv(resolve(__dirname, ".env"));
  const backendEnv = loadEnvFileWithProcessEnv(
    resolve(__dirname, "../back/.env"),
  );

  return {
    ...e2eBackendEnv,
    ...jwtEnv,
    PC_USERNAME:
      playwrightEnv.PC_USERNAME ??
      "recette+playwright@immersion-facile.beta.gouv.fr",
    PC_PASSWORD: playwrightEnv.PC_PASSWORD ?? "password123",
    PC_ADMIN_PASSWORD: playwrightEnv.PC_ADMIN_PASSWORD ?? "password123",
    PRO_CONNECT_CLIENT_SECRET: backendEnv.PRO_CONNECT_CLIENT_SECRET,
    API_KEY_OPEN_CAGE_DATA_GEOCODING:
      backendEnv.API_KEY_OPEN_CAGE_DATA_GEOCODING,
    API_KEY_OPEN_CAGE_DATA_GEOSEARCH:
      backendEnv.API_KEY_OPEN_CAGE_DATA_GEOSEARCH,
    DATABASE_URL:
      process.env.E2E_DATABASE_URL ??
      "postgresql://immersion:pg_password@localhost:5432/immersion-db",
    CORS_ALLOWED_ORIGINS: baseURL,
    PORT: backPort.toString(),
  };
};
