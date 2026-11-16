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
export const visitorSessionCookieName: VisitorSessionCookieName = "if_visitor";

export type VisitorSessionPayload = {
  sessionId: VisitorSessionId;
};

export type VisitorSession<
  K extends OtpChallengePurpose = OtpChallengePurpose,
> = {
  [P in K]: {
    id: VisitorSessionId;
    purpose: P;
    subject: OtpChallengeSubjectByPurpose[P];
    expiresAt: DateTimeIsoString;
    revokedAt: DateTimeIsoString | null;
    createdAt: DateTimeIsoString;
  };
}[K];

export type GetVisitorSessionQueryParams<
  K extends OtpChallengePurpose = OtpChallengePurpose,
> = {
  [P in K]: {
    manageConvention: {
      purpose: "manageConvention";
      conventionId: ConventionId;
    };
  }[P];
}[K];

export type ActiveVisitorSession<
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
