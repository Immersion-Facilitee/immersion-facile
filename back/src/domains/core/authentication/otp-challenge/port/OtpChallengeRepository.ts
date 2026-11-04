import type { OtpChallenge, OtpChallengeId } from "shared";

export type GetOtpChallengesByPurposeAndSubjectParams = Pick<
  OtpChallenge,
  "purpose" | "subject"
>;

export type RevokeOtpChallengeParams = {
  id: OtpChallengeId;
  revokedAt: Date;
};

export interface OtpChallengeRepository {
  save(otpChallenge: OtpChallenge): Promise<void>;
  revoke(params: RevokeOtpChallengeParams): Promise<void>;
  getById(id: OtpChallengeId): Promise<OtpChallenge | null>;
  getByPurposeAndSubject(
    params: GetOtpChallengesByPurposeAndSubjectParams,
  ): Promise<OtpChallenge[]>;
}
