import { defineRoute, defineRoutes } from "shared-routes";
import {
  httpErrorSchema,
  maskedOtpRecipientsSchema,
  withAuthorizationHeaders,
} from "../..";
import { expressEmptyResponseBody } from "../../zodUtils";
import { requestOtpChallengeSchema } from "./otpChallenge.schema";

export type OtpChallengeRoutes = typeof otpChallengeRoutes;
export const otpChallengeRoutes = defineRoutes({
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
      200: expressEmptyResponseBody,
      400: httpErrorSchema,
      401: httpErrorSchema,
      403: httpErrorSchema,
      404: httpErrorSchema,
      429: httpErrorSchema,
    },
  }),
});
