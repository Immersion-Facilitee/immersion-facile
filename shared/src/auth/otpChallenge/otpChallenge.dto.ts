import type { ConventionId } from "../../convention/convention.dto";
import type { Email } from "../../email/email.dto";
import type { PhoneNumber } from "../../phone/phone.dto";
import type { ConventionActorRole } from "../../role/role.dto";
import type { Flavor } from "../../typeFlavors";
import type { DateTimeIsoString } from "../../utils/date";

export type OtpChallengeId = Flavor<string, "OtpChallengeId">;

export const otpChallengePurposes = ["manageConvention"] as const;
export type OtpChallengePurpose = (typeof otpChallengePurposes)[number];

export type ManageConventionSubject = {
  conventionId: ConventionId;
  role: ConventionActorRole;
  emailHash: string;
};

export type OtpChallengeSubjectByPurpose = {
  [K in OtpChallengePurpose]: {
    manageConvention: ManageConventionSubject;
  }[K];
};

export type OtpChallenge = {
  [K in OtpChallengePurpose]: {
    id: OtpChallengeId;
    purpose: K;
    subject: OtpChallengeSubjectByPurpose[K];
    channel: "email" | "sms";
    recipient: Email | PhoneNumber;
    codeHash: string;
    attempts: number;
    expiresAt: DateTimeIsoString;
    usedAt: DateTimeIsoString | null;
    createdAt: DateTimeIsoString;
  };
}[OtpChallengePurpose];
