import type { McpServer } from "@modelcontextprotocol/server";

import { registerTool } from "../lib/registerTool";

export const registerHealthCheckTool = (server: McpServer) => {
  registerTool(
    server,
    "health_check",
    {
      description:
        "Checks that the Immersion Facilitée MCP server is available.",
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: "Immersion Facilitée MCP server is running.",
        },
      ],
    }),
  );
};
