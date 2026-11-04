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
  getById(id: OtpChallengeId): Promise<OtpChallenge | null>;
  getByPurposeAndSubject(
    params: GetOtpChallengesByPurposeAndSubjectParams,
  ): Promise<OtpChallenge[]>;
}
