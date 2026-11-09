import type { ConventionId } from "../../convention/convention.dto";
import type { ConventionActorRole } from "../../role/role.dto";
import type { Flavor } from "../../typeFlavors";
import type { DateTimeIsoString } from "../../utils/date";
import type {
  OtpChallengePurpose,
  OtpChallengeSubjectByPurpose,
} from "../otpChallenge/otpChallenge.dto";

export type VisitorSessionId = Flavor<string, "VisitorSessionId">;
export type VisitorSessionCookieName = Flavor<
  string,
  "VisitorSessionCookieName"
>;

export type VisitorSession = {
  [K in OtpChallengePurpose]: {
    id: VisitorSessionId;
    purpose: K;
    subject: OtpChallengeSubjectByPurpose[K];
    expiresAt: DateTimeIsoString;
    revokedAt: DateTimeIsoString | null;
    createdAt: DateTimeIsoString;
  };
}[OtpChallengePurpose];

export type GetVisitorSessionQueryParams = {
  [K in OtpChallengePurpose]: {
    manageConvention: {
      purpose: "manageConvention";
      conventionId: ConventionId;
    };
  }[K];
}[OtpChallengePurpose];

export type GetVisitorSessionParams = GetVisitorSessionQueryParams & {
  sessionId: VisitorSessionId;
};

export type ActiveVisitorSession = {
  [K in OtpChallengePurpose]: {
    manageConvention: {
      purpose: "manageConvention";
      conventionId: ConventionId;
      role: ConventionActorRole;
      expiresAt: DateTimeIsoString;
    };
  }[K];
}[OtpChallengePurpose];
