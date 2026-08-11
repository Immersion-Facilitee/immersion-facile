import { defineRoute, defineRoutes } from "shared-routes";
import z from "zod";
import { apiConsumerReadSchema } from "../apiConsumer/apiConsumer.schema";
import {
  archivedConventionRequestSchema,
  archivedConventionRequestToReviewListDtoSchema,
} from "../archivedConventionRequest/archivedConventionRequest.schema";
import {
  assessmentDtoSchema,
  deleteAssessmentRequestDtoSchema,
  legacyAssessmentDtoSchema,
  signAssessmentRequestDtoSchema,
} from "../assessment/assessment.schema";
import { broadcastFeedbackSchema } from "../broadcast/broadcastFeedback.schema";
import { addConventionInputSchema } from "../convention/addConventionInput";
import { paginatedAgencyUserConventionListSchema } from "../convention/agencyUserConventionList.schema";
import {
  conventionReadSchema,
  editConventionCounsellorNameRequestSchema,
  editConventionWithFinalStatusRequestSchema,
  findSimilarConventionsParamsSchema,
  findSimilarConventionsResponseSchema,
  flatGetConventionsForAgencyUserParamsSchema,
  markPartnersErroredConventionAsHandledRequestSchema,
  renewConventionParamsSchema,
  transferConventionToAgencyRequestSchema,
  updateConventionRequestSchema,
  updateConventionStatusRequestSchema,
  withConventionIdLegacySchema,
  withConventionIdSchema,
} from "../convention/convention.schema";
import { beneficiaryConventionListDtoSchema } from "../convention/conventionBeneficiaryList";
import { conventionTemplateSchema } from "../convention/conventionTemplate.schema";
import {
  flatGetConventionsWithErroredBroadcastFeedbackParamsSchema,
  paginatedConventionWithBroadcastFeedbackSchema,
} from "../convention/conventionWithBroadcastFeedback.schema";
import {
  flatGetConventionsWithUnfinalizedAssessmentParamsSchema,
  paginatedConventionWithUnfinalizedAssessmentSchema,
} from "../convention/conventionWithUnfinalizedAssessment.schema";
import {
  conventionDraftSchema,
  saveConventionDraftSchema,
} from "../convention/saveConventionDraft.schema";
import { dashboardUrlAndNameSchema } from "../dashboard/dashboard.schema";
import { withAuthorizationHeaders } from "../headers";
import { httpErrorSchema } from "../httpClient/httpErrors.schema";
import {
  sendAssessmentLinkRequestSchema,
  sendSignatureLinkRequestSchema,
} from "../notifications/notifications.schema";
import { renewExpiredJwtResponseSchema } from "../tokens/jwt.schema";
import {
  expressEmptyResponseBody,
  expressEmptyResponseBodyOrEmptyObject,
} from "../zodUtils";

export type ConventionMagicLinkRoutes = typeof conventionMagicLinkRoutes;
export const conventionMagicLinkRoutes = defineRoutes({
  createAssessment: defineRoute({
    url: "/auth/assessment",
    method: "post",
    ...withAuthorizationHeaders,
    requestBodySchema: assessmentDtoSchema,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),

  deleteAssessment: defineRoute({
    url: "/auth/assessment",
    method: "delete",
    ...withAuthorizationHeaders,
    requestBodySchema: deleteAssessmentRequestDtoSchema,
    responses: {
      204: expressEmptyResponseBodyOrEmptyObject,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  getAssessmentByConventionId: defineRoute({
    url: "/auth/convention/:conventionId/assessment",
    method: "get",
    ...withAuthorizationHeaders,
    responses: {
      200: assessmentDtoSchema.or(legacyAssessmentDtoSchema),
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  signAssessment: defineRoute({
    url: "/auth/sign-assessment",
    method: "post",
    ...withAuthorizationHeaders,
    requestBodySchema: signAssessmentRequestDtoSchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),

  getConvention: defineRoute({
    url: "/auth/demandes-immersion/:conventionId",
    method: "get",
    ...withAuthorizationHeaders,
    responses: {
      200: conventionReadSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema.or(httpErrorSchema),
      404: httpErrorSchema,
    },
  }),
  getConventionStatusDashboard: defineRoute({
    url: "/auth/status-convention/:conventionId",
    method: "get",
    ...withAuthorizationHeaders,
    responses: {
      200: dashboardUrlAndNameSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  signConvention: defineRoute({
    url: "/auth/sign-application/:conventionId",
    method: "post",
    ...withAuthorizationHeaders,
    responses: {
      200: withConventionIdLegacySchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  updateConvention: defineRoute({
    url: "/auth/demandes-immersion/:conventionId",
    method: "post",
    requestBodySchema: updateConventionRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: withConventionIdLegacySchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  updateConventionStatus: defineRoute({
    url: "/auth/update-application-status",
    method: "post",
    requestBodySchema: updateConventionStatusRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: withConventionIdLegacySchema,
      400: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  renewConvention: defineRoute({
    url: "/auth/renew-convention",
    method: "post",
    requestBodySchema: renewConventionParamsSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
    },
  }),

  sendSignatureLink: defineRoute({
    url: "/auth/convention/signatories/send-signature-link",
    method: "post",
    requestBodySchema: sendSignatureLinkRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),

  sendAssessmentLink: defineRoute({
    url: "/auth/assessment/send-assessment-link",
    method: "post",
    requestBodySchema: sendAssessmentLinkRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),

  sendAssessmentSignatureReminder: defineRoute({
    url: "/auth/assessment/send-assessment-signature-reminder",
    method: "post",
    requestBodySchema: sendAssessmentLinkRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),

  transferConventionToAgency: defineRoute({
    url: "/auth/convention/transfer-to-agency",
    method: "post",
    requestBodySchema: transferConventionToAgencyRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  editConventionCounsellorName: defineRoute({
    url: "/auth/convention/edit-counsellor-name",
    method: "post",
    requestBodySchema: editConventionCounsellorNameRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  editConventionWithFinalStatus: defineRoute({
    url: "/auth/convention/edit-convention-with-final-status",
    method: "post",
    requestBodySchema: editConventionWithFinalStatusRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  createArchivedConventionRequest: defineRoute({
    url: "/auth/archived-convention",
    method: "post",
    requestBodySchema: archivedConventionRequestSchema,
    ...withAuthorizationHeaders,
    responses: {
      201: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),
});

export type UnauthenticatedConventionRoutes =
  typeof unauthenticatedConventionRoutes;
export const unauthenticatedConventionRoutes = defineRoutes({
  createConvention: defineRoute({
    url: "/demandes-immersion",
    method: "post",
    requestBodySchema: addConventionInputSchema,
    responses: {
      200: withConventionIdLegacySchema,
      400: httpErrorSchema,
      409: httpErrorSchema,
      503: httpErrorSchema,
    },
  }),
  saveConventionDraft: defineRoute({
    url: "/convention-drafts",
    method: "post",
    requestBodySchema: saveConventionDraftSchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      409: httpErrorSchema,
    },
  }),

  getConventionDraft: defineRoute({
    url: "/convention-drafts/:conventionDraftId",
    method: "get",
    responses: {
      200: conventionDraftSchema,
      400: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  findSimilarConventions: defineRoute({
    url: "/find-similar-immersion",
    method: "get",
    queryParamsSchema: findSimilarConventionsParamsSchema,
    responses: {
      200: findSimilarConventionsResponseSchema,
      400: httpErrorSchema,
    },
  }),
});

export type AuthenticatedConventionRoutes =
  typeof authenticatedConventionRoutes;

export const authenticatedConventionRoutes = defineRoutes({
  fetchArchivedConventionRequestToReviewList: defineRoute({
    method: "get",
    url: "/archived-convention-requests",
    ...withAuthorizationHeaders,
    responses: {
      200: archivedConventionRequestToReviewListDtoSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  getApiConsumersByConvention: defineRoute({
    method: "get",
    url: "/conventions/:conventionId/api-consumers",
    ...withAuthorizationHeaders,
    responses: {
      200: apiConsumerReadSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  getBeneficiaryConventionList: defineRoute({
    method: "get",
    url: "/conventions/beneficiary",
    ...withAuthorizationHeaders,
    responses: {
      200: beneficiaryConventionListDtoSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),

  getConventionsForAgencyUser: defineRoute({
    method: "get",
    url: "/conventions-for-agency-user",
    ...withAuthorizationHeaders,
    queryParamsSchema: flatGetConventionsForAgencyUserParamsSchema,
    responses: {
      200: paginatedAgencyUserConventionListSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),

  getConventionsWithErroredBroadcastFeedbackForAgencyUser: defineRoute({
    method: "get",
    url: "/inclusion-connected/conventions-with-errored-broadcast-feedback",
    ...withAuthorizationHeaders,
    queryParamsSchema:
      flatGetConventionsWithErroredBroadcastFeedbackParamsSchema,
    responses: {
      200: paginatedConventionWithBroadcastFeedbackSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),

  getConventionsWithUnfinalizedAssessment: defineRoute({
    method: "get",
    url: "/conventions-with-unfinalized-assessment",
    ...withAuthorizationHeaders,
    queryParamsSchema: flatGetConventionsWithUnfinalizedAssessmentParamsSchema,
    responses: {
      200: paginatedConventionWithUnfinalizedAssessmentSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
    },
  }),

  markPartnersErroredConventionAsHandled: defineRoute({
    url: "/inclusion-connected/mark-errored-convention-as-handled",
    method: "post",
    ...withAuthorizationHeaders,
    requestBodySchema: markPartnersErroredConventionAsHandledRequestSchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  broadcastConventionAgain: defineRoute({
    url: "/inclusion-connected/broadcast-convention-again",
    method: "post",
    ...withAuthorizationHeaders,
    requestBodySchema: withConventionIdSchema,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),

  getConventionLastBroadcastFeedback: defineRoute({
    url: "/conventions/:conventionId/last-broadcast-feedback",
    method: "get",
    ...withAuthorizationHeaders,
    responses: {
      200: broadcastFeedbackSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),

  getConventionTemplatesForCurrentUser: defineRoute({
    url: "/convention-templates",
    method: "get",
    ...withAuthorizationHeaders,
    responses: {
      200: z.array(conventionTemplateSchema),
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),

  createOrUpdateConventionTemplate: defineRoute({
    url: "/convention-templates",
    method: "post",
    requestBodySchema: conventionTemplateSchema,
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),

  deleteConventionTemplate: defineRoute({
    url: "/convention-templates/:conventionTemplateId",
    method: "delete",
    ...withAuthorizationHeaders,
    responses: {
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
});
