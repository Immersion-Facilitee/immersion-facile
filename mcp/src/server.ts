import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import { registerGetLegalInfoTool } from "./tools/getLegalInfo";
import { registerSearchImmersionOffersTool } from "./tools/searchImmersionOffers";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env");
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3100);

const LOOPBACK_BIND_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

if (!LOOPBACK_BIND_HOSTS.has(HOST)) {
  throw new Error(
    `MCP server refuses to bind to non-loopback HOST=${HOST} without authentication. Use 127.0.0.1 (default), ::1 or localhost, or put auth / a reverse-proxy in front before exposing the server.`,
  );
}

const createImmersionFacileMcpServer = () => {
  const server = new McpServer(
    {
      name: "immersion-facile",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "Provides tools related to Immersion Facilitée and PMSMP in France. Use search_immersion_offers to find host companies, and get_legal_info for PMSMP regulatory questions.",
    },
  );

  registerGetLegalInfoTool(server);
  registerSearchImmersionOffersTool(server);

  return server;
};

const mcpHandler = createMcpHandler(() => createImmersionFacileMcpServer());

const httpHandler = toNodeHandler(mcpHandler);
const validateHost = localhostHostValidation();
const validateOrigin = localhostOriginValidation();

createServer((req, res) => {
  if (!validateHost(req, res) || !validateOrigin(req, res)) {
    return;
  }
  return httpHandler(req, res);
}).listen(PORT, HOST, () => {
  console.log(
    `Immersion Facilitée MCP server listening on http://${HOST}:${PORT}`,
  );
});
