import type { McpServer } from "@modelcontextprotocol/server";
import { getOffersFlatParamsSchemaPublicV3Schema } from "shared";
import { z } from "zod";

import { formatSearchResult } from "../lib/formatOffer";
import {
  ImmersionFacileApiError,
  searchImmersionOffers,
} from "../lib/immersionFacileApi";

const searchImmersionOffersInputSchema = z.object({
  appellationCodes: z
    .array(z.string())
    .optional()
    .describe(
      "ROME appellation codes (5 or 6 digits) for the target occupations.",
    ),
  place: z
    .string()
    .optional()
    .describe(
      "Location label typed by the user (analytics only — does not filter results). Use latitude/longitude/distanceKm for geographic filtering.",
    ),
  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Latitude of the search center."),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Longitude of the search center."),
  distanceKm: z
    .number()
    .positive()
    .max(100)
    .optional()
    .describe(
      "Search radius in kilometers (max 100). Required with latitude/longitude when sorting by distance.",
    ),
  departmentCodes: z
    .array(z.string())
    .optional()
    .describe('French department codes, e.g. ["86", "75"].'),
  locationIds: z
    .array(z.string())
    .optional()
    .describe("Establishment location UUIDs to filter on."),
  sirets: z
    .array(z.string())
    .optional()
    .describe("SIRET numbers (14 digits) to filter establishments."),
  searchableBy: z
    .enum(["students", "jobSeekers"])
    .optional()
    .describe("Audience filter: students or job seekers."),
  fitForDisabledWorkers: z
    .array(z.enum(["yes-ft-certified", "yes-declared-only", "no"]))
    .optional()
    .describe("Filter by accessibility for disabled workers."),
  remoteWorkModes: z
    .array(z.enum(["ON_SITE", "HYBRID", "FULL_REMOTE"]))
    .optional()
    .describe("Filter by remote work mode."),
  nafCodes: z
    .array(z.string())
    .optional()
    .describe("NAF activity codes to filter establishments."),
  showOnlyAvailableOffers: z
    .boolean()
    .optional()
    .describe(
      "When true, only return currently available immersion offers (API default: true).",
    ),
  sortBy: z
    .enum(["date", "score", "distance"])
    .describe(
      'Sort field. Use "distance" only with latitude, longitude and distanceKm.',
    ),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .describe(
      'Sort order. Defaults to "asc" for distance, "desc" for date/score.',
    ),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Page number (1-based)."),
  perPage: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe("Number of results per page (API default 100, max 500)."),
});

export const registerSearchImmersionOffersTool = (server: McpServer) => {
  server.registerTool(
    "search_immersion_offers",
    {
      description: `
Search Immersion Facilitée for host companies / immersion offers (PMSMP)
via the public API v3 (GET /v3/offers).

Parameters match GetOffersFlatParamsPublicV3 from shared.
Important:
- There is no free-text "job" parameter — use appellationCodes.
- place is analytics only; geographic filtering needs latitude, longitude and distanceKm.
- sortBy "distance" requires full geo params.
- Do not invent companies; only report API results.
      `.trim(),
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: searchImmersionOffersInputSchema,
    },
    async (args) => {
      try {
        const apiParams = getOffersFlatParamsSchemaPublicV3Schema.parse(args);
        const result = await searchImmersionOffers(apiParams);

        return {
          content: [
            {
              type: "text" as const,
              text: formatSearchResult(result, apiParams),
            },
          ],
          structuredContent: {
            query: apiParams,
            result,
          },
        };
      } catch (error) {
        if (error instanceof ImmersionFacileApiError) {
          const issues = error.issues?.length
            ? `\nIssues:\n- ${error.issues.join("\n- ")}`
            : "";

          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Immersion Facilitée API error (${error.status}): ${error.message}${issues}`,
              },
            ],
          };
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unknown error while searching immersions.";

        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
        };
      }
    },
  );
};
