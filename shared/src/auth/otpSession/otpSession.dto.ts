import type { ConventionId } from "../../convention/convention.dto";
import type { ConventionActorRole } from "../../role/role.dto";
import type { Flavor } from "../../typeFlavors";
import type { DateTimeIsoString } from "../../utils/date";
import type {
  OtpChallengePurpose,
  OtpChallengeSubjectByPurpose,
} from "../otpChallenge/otpChallenge.dto";

export type OtpSessionId = Flavor<string, "OtpSessionId">;
export type OtpSessionCookieName = Flavor<string, "OtpSessionCookieName">;
export const otpSessionCookieName: OtpSessionCookieName = "if_visitor";

export type OtpSessionPayload = {
  sessionId: OtpSessionId;
};

export type OtpSession<K extends OtpChallengePurpose = OtpChallengePurpose> = {
  [P in K]: {
    id: OtpSessionId;
    purpose: P;
    subject: OtpChallengeSubjectByPurpose[P];
    expiresAt: DateTimeIsoString;
    revokedAt: DateTimeIsoString | null;
    createdAt: DateTimeIsoString;
  };
}[K];

export type GetOtpSessionQueryParams<
  K extends OtpChallengePurpose = OtpChallengePurpose,
> = {
  [P in K]: {
    manageConvention: {
      purpose: "manageConvention";
      conventionId: ConventionId;
    };
  }[P];
}[K];

export type ActiveOtpSession<
  K extends OtpChallengePurpose = OtpChallengePurpose,
> = {
  [P in K]: {
    manageConvention: {
      purpose: "manageConvention";
      conventionId: ConventionId;
      role: ConventionActorRole;
      expiresAt: DateTimeIsoString;
    };
  }[P];
}[K];
