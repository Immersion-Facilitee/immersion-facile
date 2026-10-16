import type { McpServer } from "@modelcontextprotocol/server";

type ToolContent = {
  type: "text";
  text: string;
};

type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

type ToolConfig = {
  description: string;
  inputSchema?: Record<string, unknown>;
};

// MCP SDK peers zod ^4.2; shared pins 4.0.17 — Zod schema types diverge at compile time.
export const registerTool = <TArgs>(
  server: McpServer,
  name: string,
  config: ToolConfig,
  handler: (args: TArgs) => Promise<ToolResult>,
): void => {
  (
    server.registerTool as (
      toolName: string,
      toolConfig: ToolConfig,
      toolHandler: (args: TArgs) => Promise<ToolResult>,
    ) => void
  )(name, config, handler);
};
