import type { Flavor } from "../../typeFlavors";
import type { DateTimeIsoString } from "../../utils/date";
import type {
  OtpChallengePurpose,
  OtpChallengeSubjectByPurpose,
} from "../otpChallenge/otpChallenge.dto";

export type VisitorSessionId = Flavor<string, "VisitorSessionId">;

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
