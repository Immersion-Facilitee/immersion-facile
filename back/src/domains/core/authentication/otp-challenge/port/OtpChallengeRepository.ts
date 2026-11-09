import type { OtpChallenge, OtpChallengeId } from "shared";

export type GetOtpChallengesByPurposeAndSubjectParams = Pick<
  OtpChallenge,
  "purpose" | "subject"
>;

export type RevokeOtpChallengeParams = {
  id: OtpChallengeId;
  revokedAt: Date;
};

export type MarkOtpChallengeAsUsedParams = {
  id: OtpChallengeId;
  usedAt: Date;
};

export interface OtpChallengeRepository {
  save(otpChallenge: OtpChallenge): Promise<void>;
  revoke(params: RevokeOtpChallengeParams): Promise<void>;
  markAsUsed(params: MarkOtpChallengeAsUsedParams): Promise<void>;
  incrementAttempts(id: OtpChallengeId): Promise<void>;
  getByPurposeAndSubject(
    params: GetOtpChallengesByPurposeAndSubjectParams,
  ): Promise<OtpChallenge[]>;
  getActiveByPurposeAndSubject(
    params: GetOtpChallengesByPurposeAndSubjectParams,
  ): Promise<OtpChallenge | null>;
}
