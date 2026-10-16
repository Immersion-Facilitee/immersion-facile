import type { McpServer } from "@modelcontextprotocol/server";
import {
  type AppellationCode,
  addressDepartmentCodeSchema,
  appellationCodeSchema,
  fitForDisabledWorkersSchema,
  getOffersFlatParamsSchemaPublicV3Schema,
  localization,
  nafCodeSchema,
  remoteWorkModeSchema,
  siretSchema,
  sortDirectionSchema,
  zToBoolean,
  zToNumber,
  zUuidLike,
} from "shared";
import { z } from "zod";

import {
  buildOfferUrl,
  ImmersionFacileApiError,
  type ImmersionOffer,
  type SearchImmersionOffersParams,
  type SearchImmersionOffersResult,
  searchImmersionOffers,
} from "../lib/immersionFacileApi";
import { registerTool } from "../lib/registerTool";

const distanceKmSchema = zToNumber.pipe(
  z.number().positive("Cette valeur doit être positive").max(100),
);

const inputSchema = {
  appellationCodes: z
    .array(appellationCodeSchema)
    .min(1)
    .optional()
    .describe(
      "ROME appellation codes (5 or 6 digits) for the target occupations.",
    ),
  place: z
    .string()
    .max(1024)
    .optional()
    .describe(
      "Location label typed by the user (analytics only — does not filter results). Use latitude/longitude/distanceKm for geographic filtering.",
    ),
  latitude: zToNumber
    .pipe(z.number().min(-90).max(90))
    .optional()
    .describe("Latitude of the search center."),
  longitude: zToNumber
    .pipe(z.number().min(-180).max(180))
    .optional()
    .describe("Longitude of the search center."),
  distanceKm: distanceKmSchema
    .optional()
    .describe(
      "Search radius in kilometers (max 100). Required with latitude/longitude when sorting by distance.",
    ),
  departmentCodes: z
    .array(addressDepartmentCodeSchema)
    .min(1)
    .optional()
    .describe('French department codes, e.g. ["86", "75"].'),
  locationIds: z
    .array(zUuidLike)
    .min(1)
    .optional()
    .describe("Establishment location UUIDs to filter on."),
  sirets: z
    .array(siretSchema)
    .min(1)
    .optional()
    .describe("SIRET numbers (14 digits) to filter establishments."),
  searchableBy: z
    .enum(["students", "jobSeekers"], {
      error: localization.invalidEnum,
    })
    .optional()
    .describe("Audience filter: students or job seekers."),
  fitForDisabledWorkers: z
    .array(fitForDisabledWorkersSchema)
    .min(1)
    .optional()
    .describe("Filter by accessibility for disabled workers."),
  remoteWorkModes: z
    .array(remoteWorkModeSchema)
    .min(1)
    .optional()
    .describe("Filter by remote work mode."),
  nafCodes: z
    .array(nafCodeSchema)
    .min(1)
    .optional()
    .describe("NAF activity codes to filter establishments."),
  showOnlyAvailableOffers: zToBoolean
    .optional()
    .describe(
      "When true, only return currently available immersion offers (API default: true).",
    ),
  sortBy: z
    .enum(["date", "score", "distance"], {
      error: localization.invalidEnum,
    })
    .describe(
      'Sort field. Use "distance" only with latitude, longitude and distanceKm.',
    ),
  sortOrder: sortDirectionSchema
    .optional()
    .describe(
      'Sort order. Defaults to "asc" for distance, "desc" for date/score.',
    ),
  page: zToNumber
    .pipe(z.number().int().positive())
    .optional()
    .describe("Page number (1-based)."),
  perPage: zToNumber
    .pipe(z.number().int().positive().max(500))
    .optional()
    .describe("Number of results per page (API default 100, max 500)."),
};

const formatAddress = (offer: ImmersionOffer) => {
  const { streetNumberAndAddress, postcode, city } = offer.address;
  return [streetNumberAndAddress, `${postcode} ${city}`]
    .filter((part) => part.trim().length > 0)
    .join(", ");
};

const formatOffer = (
  offer: ImmersionOffer,
  index: number,
  preferredAppellationCodes?: AppellationCode[],
) => {
  const appellations = offer.appellations
    .map(
      (appellation) =>
        `${appellation.appellationLabel} (${appellation.appellationCode})`,
    )
    .join(", ");

  const distance =
    offer.distance_m === undefined
      ? undefined
      : `${Math.round(offer.distance_m / 100) / 10} km`;

  const offerUrl = buildOfferUrl(offer, preferredAppellationCodes);

  const lines = [
    `## ${index}. ${offer.customizedName || offer.name}`,
    `- SIRET: ${offer.siret}`,
    `- Métier ROME: ${offer.romeLabel} (${offer.rome})`,
    `- Appellations: ${appellations || "n/a"}`,
    `- Adresse: ${formatAddress(offer)}`,
    `- NAF: ${offer.nafLabel} (${offer.naf})`,
    `- Volontaire à l'immersion: ${offer.voluntaryToImmersion ? "oui" : "non"}`,
    `- Disponible: ${offer.isAvailable ? "oui" : "non"}`,
    `- Mode de contact: ${offer.contactMode ?? "non renseigné"}`,
    `- Mode de travail: ${offer.remoteWorkMode}`,
    `- Effectif: ${offer.numberOfEmployeeRange || "non renseigné"}`,
    `- Location ID: ${offer.locationId ?? "n/a"}`,
  ];

  if (offerUrl) {
    lines.push(`- Lien vers l'offre: ${offerUrl}`);
  }
  if (distance) {
    lines.push(`- Distance: ${distance}`);
  }
  if (offer.website) {
    lines.push(`- Site web: ${offer.website}`);
  }
  if (offer.additionalInformation) {
    lines.push(`- Infos complémentaires: ${offer.additionalInformation}`);
  }
  if (offer.urlOfPartner) {
    lines.push(`- Lien partenaire: ${offer.urlOfPartner}`);
  }

  return lines.join("\n");
};

const formatSearchResult = (
  result: SearchImmersionOffersResult,
  apiParams: SearchImmersionOffersParams,
) => {
  const { data, pagination } = result;

  if (data.length === 0) {
    return [
      "# Immersion Facilitée — search results",
      "",
      "No immersion offers found for this search.",
      "",
      `Pagination: page ${pagination.currentPage}/${pagination.totalPages}, total ${pagination.totalRecords}.`,
      "",
      "Suggestions:",
      "- Broaden the location or increase distanceKm (max 100)",
      "- Try related appellationCodes",
      "- Remove optional filters (searchableBy, remoteWorkModes, etc.)",
    ].join("\n");
  }

  return [
    `# Offers (${data.length} on this page, ${pagination.totalRecords} total)`,
    "",
    `Page ${pagination.currentPage}/${pagination.totalPages} · ${pagination.numberPerPage} per page`,
    "",
    ...data.map((offer, index) =>
      formatOffer(offer, index + 1, apiParams.appellationCodes),
    ),
    "",
    "When presenting results to the user, include the offer link (Lien vers l'offre) so they can open the page on Immersion Facilitée. Also keep SIRET, locationId and appellationCode if they later want to contact a company.",
  ].join("\n");
};

export const registerSearchImmersionOffersTool = (server: McpServer) => {
  registerTool(
    server,
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
      inputSchema,
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
          } as unknown as Record<string, unknown>,
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
