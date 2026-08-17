import { defineRoute, defineRoutes } from "shared-routes";
import { z } from "zod";
import { withAgencyIdSchemaPartial } from "../agency/agency.schema";
import {
  apiConsumerJwtSchema,
  apiConsumerSchema,
  writeApiConsumerSchema,
} from "../apiConsumer/apiConsumer.schema";
import { dashboardUrlAndNameSchema } from "../dashboard/dashboard.schema";
import { banEstablishmentPayloadSchema } from "../establishment/bannedEstablishmentInformations.schema";
import { setFeatureFlagSchema } from "../featureFlag/featureFlags.schema";
import {
  establishmentBatchReportSchema,
  formEstablishmentBatchSchema,
} from "../formEstablishment/FormEstablishment.schema";
import { withAuthorizationHeaders } from "../headers";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import { notificationsByKindSchema } from "../notifications/notifications.schema";
import { connectedUserSchema, userInListSchema } from "../user/user.schema";
import { expressEmptyResponseBody } from "../zodUtils";
import {
  getUsersFiltersSchema,
  rejectIcUserRoleForAgencyParamsSchema,
  userParamsForAgencySchema,
} from "./admin.schema";

export type AdminRoutes = typeof adminRoutes;
export const adminRoutes = defineRoutes({
  getDashboardUrl: defineRoute({
    method: "get",
    url: "/admin/dashboard/:dashboardName",
    queryParamsSchema: withAgencyIdSchemaPartial,
    ...withAuthorizationHeaders,
    responses: {
      200: dashboardUrlAndNameSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  addFormEstablishmentBatch: defineRoute({
    method: "post",
    url: "/admin/add-form-establishment-batch",
    requestBodySchema: formEstablishmentBatchSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: establishmentBatchReportSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),
  updateUserRoleForAgency: defineRoute({
    method: "patch",
    url: "/admin/inclusion-connected/users",
    requestBodySchema: userParamsForAgencySchema,
    ...withAuthorizationHeaders,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  // Cette route existe aussi dans le agency router, qui enclenche le même usecase >> c'est un bordel ici ...
  createUserForAgency: defineRoute({
    method: "post",
    url: "/admin/inclusion-connected/users",
    requestBodySchema: userParamsForAgencySchema,
    ...withAuthorizationHeaders,
    responses: {
      200: connectedUserSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  rejectIcUserForAgency: defineRoute({
    method: "delete",
    url: "/inclusion-connected/users",
    requestBodySchema: rejectIcUserRoleForAgencyParamsSchema,
    ...withAuthorizationHeaders,
    responses: {
      201: expressEmptyResponseBody,
      401: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  getLastNotifications: defineRoute({
    method: "get",
    url: "/admin/notifications",
    ...withAuthorizationHeaders,
    responses: {
      200: notificationsByKindSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  updateFeatureFlags: defineRoute({
    method: "post",
    url: "/admin/feature-flags",
    ...withAuthorizationHeaders,
    requestBodySchema: setFeatureFlagSchema,
    responses: {
      201: expressEmptyResponseBody,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  saveApiConsumer: defineRoute({
    method: "post",
    url: "/admin/api-consumers",
    requestBodySchema: writeApiConsumerSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: apiConsumerJwtSchema.or(expressEmptyResponseBody),
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  getAllApiConsumers: defineRoute({
    method: "get",
    url: "/admin/api-consumers",
    ...withAuthorizationHeaders,
    responses: {
      200: z.array(apiConsumerSchema),
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  revokeApiConsumer: defineRoute({
    method: "post",
    url: "/admin/api-consumers/:consumerId/revoke",
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),
  renewApiConsumerKey: defineRoute({
    method: "post",
    url: "/admin/api-consumers/:consumerId/renew-key",
    ...withAuthorizationHeaders,
    responses: {
      200: apiConsumerJwtSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),
  getUsers: defineRoute({
    method: "get",
    url: "/admin/users",
    ...withAuthorizationHeaders,
    queryParamsSchema: getUsersFiltersSchema,
    responses: {
      200: z.array(userInListSchema),
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  banEstablishment: defineRoute({
    method: "post",
    url: "/admin/ban-establishment",
    ...withAuthorizationHeaders,
    requestBodySchema: banEstablishmentPayloadSchema,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),
});
