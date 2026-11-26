import { defineRoute, defineRoutes } from "shared-routes";
import { createDiscussionSchema } from "../discussion/discussion.schema";
import { groupInfoSchema } from "../group/group.schema";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import {
  searchResultQuerySchema,
  siretAndAppellationSchema,
} from "../siretAndAppellation/SiretAndAppellation.schema";
import { expressEmptyResponseBody } from "../zodUtils";
import {
  externalOfferSchema,
  externalSearchResultsSchema,
  internalOfferSchema,
  paginatedSearchResultsSchema,
} from "./Offer.schema";
import {
  getExternalOffersFlatParamsSchema,
  getOffersFlatParamsSchema,
} from "./SearchQueryParams.schema";

export type SearchRoutes = typeof searchImmersionRoutes;

export const searchImmersionRoutes = defineRoutes({
  getGroupInfoBySlug: defineRoute({
    method: "get",
    url: "/groups/:groupSlug",
    responses: {
      200: groupInfoSchema,
      404: httpErrorSchema,
    },
  }),
  getOffers: defineRoute({
    method: "get",
    url: "/offers",
    queryParamsSchema: getOffersFlatParamsSchema,
    responses: {
      200: paginatedSearchResultsSchema,
      400: httpErrorSchema,
    },
  }),
  getExternalOffers: defineRoute({
    method: "get",
    url: "/external-offers",
    queryParamsSchema: getExternalOffersFlatParamsSchema,
    responses: {
      200: externalSearchResultsSchema,
      400: httpErrorSchema,
    },
  }),
  contactEstablishment: defineRoute({
    method: "post",
    url: "/contact-establishment",
    requestBodySchema: createDiscussionSchema,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      404: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),
  getSearchResult: defineRoute({
    method: "get",
    url: "/search-result",
    queryParamsSchema: searchResultQuerySchema,
    responses: {
      200: internalOfferSchema,
      400: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  getExternalSearchResult: defineRoute({
    method: "get",
    url: "/external-search-result",
    queryParamsSchema: siretAndAppellationSchema,
    responses: {
      200: externalOfferSchema,
      400: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
});
