import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import { registerGetLegalInfoTool } from "./tools/getLegalInfo";
import { registerHealthCheckTool } from "./tools/healthCheck";
import { registerSearchImmersionOffersTool } from "./tools/searchImmersionOffers";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env");
if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const PORT = Number(process.env.PORT ?? 3000);

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

  registerHealthCheckTool(server);
  registerGetLegalInfoTool(server);
  registerSearchImmersionOffersTool(server);

  return server;
};

const mcpHandler = createMcpHandler(() => createImmersionFacileMcpServer());

const httpHandler = toNodeHandler(mcpHandler);

createServer(httpHandler).listen(PORT, () => {
  console.log(
    `Immersion Facilitée MCP server listening on http://localhost:${PORT}`,
  );
});
