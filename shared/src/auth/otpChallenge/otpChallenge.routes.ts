import { defineRoute, defineRoutes } from "shared-routes";
import {
  httpErrorSchema,
  maskedOtpRecipientsSchema,
  withAuthorizationHeaders,
} from "../..";
import { renewExpiredJwtResponseSchema } from "../../tokens/jwt.schema";
import { expressEmptyResponseBodyOrEmptyObject } from "../../zodUtils";
import {
  activeOtpSessionSchema,
  getOtpSessionQueryParamsSchema,
} from "../otpSession/otpSession.schema";
import {
  requestOtpChallengeSchema,
  verifyOtpChallengeSchema,
} from "./otpChallenge.schema";

export type OtpChallengeRoutes = typeof otpChallengeRoutes;
export const otpChallengeRoutes = defineRoutes({
  getOtpSession: defineRoute({
    method: "get",
    url: "/otp/session",
    queryParamsSchema: getOtpSessionQueryParamsSchema,
    responses: {
      200: activeOtpSessionSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
    },
  }),
  getMaskedOtpRecipient: defineRoute({
    method: "get",
    url: "/otp/masked-otp-recipient",
    ...withAuthorizationHeaders,
    responses: {
      200: maskedOtpRecipientsSchema,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema.or(httpErrorSchema),
      404: httpErrorSchema,
    },
  }),
  requestOtpChallenge: defineRoute({
    method: "post",
    url: "/otp",
    requestBodySchema: requestOtpChallengeSchema,
    ...withAuthorizationHeaders,
    responses: {
      204: expressEmptyResponseBodyOrEmptyObject,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema.or(httpErrorSchema),
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
  verifyOtpChallenge: defineRoute({
    method: "post",
    url: "/otp/verify",
    requestBodySchema: verifyOtpChallengeSchema,
    ...withAuthorizationHeaders,
    responses: {
      204: expressEmptyResponseBodyOrEmptyObject,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: renewExpiredJwtResponseSchema.or(httpErrorSchema),
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
});
