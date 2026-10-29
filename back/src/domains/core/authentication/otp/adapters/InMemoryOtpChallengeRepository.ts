import { errors, type OtpChallenge, type OtpChallengeId } from "shared";
import type { OtpChallengeRepository } from "../port/OtpChallengeRepository";

export class InMemoryOtpChallengeRepository implements OtpChallengeRepository {
  #otpChallengesById: Record<OtpChallengeId, OtpChallenge> = {};

  public async save(otpChallenge: OtpChallenge): Promise<void> {
    if (this.#otpChallengesById[otpChallenge.id])
      throw errors.otpChallenge.alreadyExists(otpChallenge.id);

    this.#otpChallengesById[otpChallenge.id] = otpChallenge;
  }

  public async getById(id: OtpChallengeId): Promise<OtpChallenge | null> {
    return this.#otpChallengesById[id] || null;
  }
}
