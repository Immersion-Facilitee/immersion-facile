import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { registerTool } from "../lib/registerTool";

const legalFrameworkPath = fileURLToPath(
  new URL("../../skill/references/legal-framework.md", import.meta.url),
);

const sourcesPath = fileURLToPath(
  new URL("../../skill/references/sources.md", import.meta.url),
);

export const registerGetLegalInfoTool = (server: McpServer) => {
  registerTool<{ question: string }>(
    server,
    "get_legal_info",
    {
      description: `
Retrieve authoritative information about Immersion Facilitée and the legal
framework of PMSMP (Périodes de Mise en Situation en Milieu Professionnel)
in France.

Use this tool whenever answering a question about PMSMP eligibility,
duration, convention, remuneration, insurance, rights and obligations,
host companies, prescribers, or the regulatory framework surrounding
a professional immersion.
      `.trim(),
      inputSchema: {
        question: z
          .string()
          .min(1)
          .describe(
            "The user's question about PMSMP or the legal framework of professional immersions.",
          ),
      },
    },
    async ({ question }) => {
      const [legalFramework, sources] = await Promise.all([
        readFile(legalFrameworkPath, "utf8"),
        readFile(sourcesPath, "utf8"),
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: `
# User question

${question}

# Instructions

Use the reference material below as the primary source of truth.

- Do not invent legal rules.
- Do not invent durations, eligibility requirements, exceptions or legal references.
- Do not present conditional rules as universal rules.
- Prefer the provided references over general model knowledge.
- If the references are insufficient, say so.
- Answer in the user's language.

# PMSMP legal framework

${legalFramework}

# Official sources

${sources}
            `.trim(),
          },
        ],
      };
    },
  );
};
