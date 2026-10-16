import { defineRoute, defineRoutes } from "shared-routes";
import { z } from "zod";
import { withAuthorizationHeaders } from "../headers";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import { contactEstablishmentPublicV3Schema } from "./ContactEstablishmentPublicV3.schema";
import { getOffersFlatParamsSchemaPublicV3Schema } from "./GetOffersPublicV3.schema";
import {
  paginatedSearchResultsPublicV3Schema,
  searchImmersionResultPublicV3Schema,
} from "./SearchImmersionResultPublicV3.schema";

export type PublicApiV3SearchEstablishmentRoutes =
  typeof publicApiV3SearchEstablishmentRoutes;

export const publicApiV3SearchEstablishmentRoutes = defineRoutes({
  contactEstablishment: defineRoute({
    method: "post",
    url: "/v3/apply-to-offer",
    requestBodySchema: contactEstablishmentPublicV3Schema,
    ...withAuthorizationHeaders,
    responses: {
      201: z.void(),
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
  getOffer: defineRoute({
    method: "get",
    url: "/v3/offers/:siret/:appellationCode/:locationId?",
    ...withAuthorizationHeaders,
    responses: {
      200: searchImmersionResultPublicV3Schema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
  getOffers: defineRoute({
    method: "get",
    url: "/v3/offers",
    ...withAuthorizationHeaders,
    queryParamsSchema: getOffersFlatParamsSchemaPublicV3Schema,
    responses: {
      200: paginatedSearchResultsPublicV3Schema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
});
