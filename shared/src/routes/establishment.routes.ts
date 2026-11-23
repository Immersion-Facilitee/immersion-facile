import { defineRoute, defineRoutes } from "shared-routes";
import {
  discussionExchangeForbiddenParamsSchema,
  discussionReadSchema,
  exchangeReadSchema,
  flatGetPaginatedDiscussionsParamsSchema,
  paginatedDiscussionListSchema,
  withDiscussionStatusSchema,
  withExchangeMessageSchema,
} from "../discussion/discussion.schema";
import {
  discussionEstablishmentContactInfoSchema,
  establishmentNameAndAdminsSchema,
  establishmentPublicOptionsSchema,
  getEstablishmentPublicOptionsByFiltersSchema,
} from "../establishment/establishment.schema";
import {
  formEstablishmentPendingUserRightSchema,
  formEstablishmentSchema,
} from "../formEstablishment/FormEstablishment.schema";
import { withAuthorizationHeaders } from "../headers";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import { renewExpiredJwtResponseSchema } from "../tokens/jwt.schema";
import { emptyObjectSchema, expressEmptyResponseBody } from "../zodUtils";

export type EstablishmentRoutes = typeof establishmentRoutes;

export const establishmentRoutes = defineRoutes({
  addFormEstablishment: defineRoute({
    method: "post",
    url: "/form-establishments",
    requestBodySchema: formEstablishmentSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      403: httpErrorSchema,
    },
  }),
  updateFormEstablishment: defineRoute({
    method: "put",
    url: "/form-establishments",
    requestBodySchema: formEstablishmentSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      404: httpErrorSchema,
      403: renewExpiredJwtResponseSchema,
      409: httpErrorSchema,
    },
  }),
  getFormEstablishment: defineRoute({
    method: "get",
    url: "/form-establishments/:siret",
    ...withAuthorizationHeaders,
    responses: {
      200: formEstablishmentSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema || httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  deleteEstablishment: defineRoute({
    method: "delete",
    url: "/form-establishments/:siret",
    ...withAuthorizationHeaders,
    responses: {
      204: emptyObjectSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema,
      404: httpErrorSchema,
    },
  }),
  getEstablishmentNameAndAdmins: defineRoute({
    method: "get",
    url: "/establishments/:siret/nameAndAdmins",
    ...withAuthorizationHeaders,
    responses: {
      200: establishmentNameAndAdminsSchema,
      404: httpErrorSchema,
    },
  }),
  getEstablishmentPublicOptionsByFilters: defineRoute({
    method: "get",
    url: "/establishments/public-options",
    ...withAuthorizationHeaders,
    queryParamsSchema: getEstablishmentPublicOptionsByFiltersSchema,
    responses: {
      200: establishmentPublicOptionsSchema,
      401: httpErrorSchema,
    },
  }),
  getDiscussions: defineRoute({
    method: "get",
    url: "/discussions",
    ...withAuthorizationHeaders,
    queryParamsSchema: flatGetPaginatedDiscussionsParamsSchema,
    responses: {
      200: paginatedDiscussionListSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),
  getDiscussionById: defineRoute({
    method: "get",
    url: "/discussions/:discussionId",
    ...withAuthorizationHeaders,
    responses: {
      200: discussionReadSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  getDiscussionEstablishmentContactInfo: defineRoute({
    method: "get",
    url: "/discussions/:discussionId/additional-establishment-information",
    ...withAuthorizationHeaders,
    responses: {
      200: discussionEstablishmentContactInfoSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  updateDiscussionStatus: defineRoute({
    method: "patch",
    url: "/discussion-for-establishment/:discussionId",
    ...withAuthorizationHeaders,
    requestBodySchema: withDiscussionStatusSchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  closeDiscussionByCandidate: defineRoute({
    method: "post",
    url: "/discussions/:discussionId/close",
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  replyToDiscussion: defineRoute({
    method: "post",
    url: "/discussion-for-establishment/:discussionId/send-message",
    ...withAuthorizationHeaders,
    requestBodySchema: withExchangeMessageSchema,
    responses: {
      200: exchangeReadSchema,
      202: discussionExchangeForbiddenParamsSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  registerUserOnEstablishment: defineRoute({
    method: "post",
    url: "/establishments/:siret/register-user",
    ...withAuthorizationHeaders,
    requestBodySchema: formEstablishmentPendingUserRightSchema,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
});
