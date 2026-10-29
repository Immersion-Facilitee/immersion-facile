import type { OtpChallenge, OtpChallengeId } from "shared";

export interface OtpChallengeRepository {
  save(otpChallenge: OtpChallenge): Promise<void>;
  getById(id: OtpChallengeId): Promise<OtpChallenge | null>;
}
