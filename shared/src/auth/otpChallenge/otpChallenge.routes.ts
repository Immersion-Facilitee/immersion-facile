import { defineRoute, defineRoutes } from "shared-routes";
import {
  httpErrorSchema,
  maskedOtpRecipientsSchema,
  withAuthorizationHeaders,
} from "../..";
import { expressEmptyResponseBodyOrEmptyObject } from "../../zodUtils";
import {
  activeVisitorSessionSchema,
  getVisitorSessionQueryParamsSchema,
} from "../visitorSession/visitorSession.schema";
import {
  requestOtpChallengeSchema,
  verifyOtpChallengeSchema,
} from "./otpChallenge.schema";

export type OtpChallengeRoutes = typeof otpChallengeRoutes;
export const otpChallengeRoutes = defineRoutes({
  getVisitorSession: defineRoute({
    method: "get",
    url: "/otp-challenge/session",
    queryParamsSchema: getVisitorSessionQueryParamsSchema,
    responses: {
      200: activeVisitorSessionSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  getMaskedOtpRecipient: defineRoute({
    method: "get",
    url: "/otp-challenge/masked-otp-recipient",
    ...withAuthorizationHeaders,
    responses: {
      200: maskedOtpRecipientsSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
    },
  }),
  requestOtpChallenge: defineRoute({
    method: "post",
    url: "/otp-challenge",
    requestBodySchema: requestOtpChallengeSchema,
    ...withAuthorizationHeaders,
    responses: {
      204: expressEmptyResponseBodyOrEmptyObject,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
  verifyOtpChallenge: defineRoute({
    method: "post",
    url: "/otp-challenge/verify",
    requestBodySchema: verifyOtpChallengeSchema,
    ...withAuthorizationHeaders,
    responses: {
      204: expressEmptyResponseBodyOrEmptyObject,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
});
