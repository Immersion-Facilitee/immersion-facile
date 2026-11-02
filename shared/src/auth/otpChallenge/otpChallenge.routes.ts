import { defineRoute, defineRoutes } from "shared-routes";
import {
  httpErrorSchema,
  maskedOtpRecipientsSchema,
  withAuthorizationHeaders,
} from "../..";

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
});
