import { createHmac } from "node:crypto";
import type { OtpChallengeId, OtpCode } from "shared";

export type HashOtpCode = (params: {
  otpChallengeId: OtpChallengeId;
  otpCode: OtpCode;
}) => string;

export const makeHashOtpCode =
  (hmacSecret: string): HashOtpCode =>
  ({ otpChallengeId, otpCode }) =>
    createHmac("sha256", hmacSecret)
      .update(`${otpChallengeId}:${otpCode}`)
      .digest("hex");
