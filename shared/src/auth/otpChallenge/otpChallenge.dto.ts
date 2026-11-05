import type { ConventionId } from "../../convention/convention.dto";
import type { Email } from "../../email/email.dto";
import type { NotificationKind } from "../../notifications/notifications.dto";
import type { PhoneNumber } from "../../phone/phone.dto";
import type { ConventionActorRole } from "../../role/role.dto";
import type { Flavor } from "../../typeFlavors";
import type { DateTimeIsoString } from "../../utils/date";

export type OtpChallengeId = Flavor<string, "OtpChallengeId">;

export type OtpCode = Flavor<string, "OtpCode">;

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
    channel: NotificationKind;
    recipient: Email | PhoneNumber;
    codeHash: string;
    attempts: number;
    expiresAt: DateTimeIsoString;
    usedAt: DateTimeIsoString | null;
    revokedAt: DateTimeIsoString | null;
    createdAt: DateTimeIsoString;
  };
}[OtpChallengePurpose];

export type MaskedOtpRecipients = {
  maskedEmail: string;
  maskedPhone: string | null;
};

export type RequestOtpChallengeDto = Pick<OtpChallenge, "channel">;

export type RequestOtpChallengeResponseDto = {
  otpChallengeId: OtpChallengeId;
};

export type VerifyOtpChallengeParams = {
  otpCode: OtpCode;
  otpChallengeId: OtpChallengeId;
};
