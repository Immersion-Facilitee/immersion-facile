import { equals, values } from "ramda";
import { errors, type OtpChallenge, type OtpChallengeId } from "shared";
import type {
  GetOtpChallengesByPurposeAndSubjectParams,
  OtpChallengeRepository,
  RevokeOtpChallengeParams,
} from "../port/OtpChallengeRepository";

export class InMemoryOtpChallengeRepository implements OtpChallengeRepository {
  #otpChallengesById: Record<OtpChallengeId, OtpChallenge> = {};

  // test purpose
  public get otpChallenges(): OtpChallenge[] {
    return values(this.#otpChallengesById);
  }

  public set otpChallenges(otpChallenges: OtpChallenge[]) {
    this.#otpChallengesById = otpChallenges.reduce<
      Record<OtpChallengeId, OtpChallenge>
    >((acc, otpChallenge) => ({ ...acc, [otpChallenge.id]: otpChallenge }), {});
  }

  public async save(otpChallenge: OtpChallenge): Promise<void> {
    if (this.#otpChallengesById[otpChallenge.id])
      throw errors.otpChallenge.alreadyExists(otpChallenge.id);

    this.#otpChallengesById[otpChallenge.id] = otpChallenge;
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeOtpChallengeParams): Promise<void> {
    const otpChallenge = this.#otpChallengesById[id];

    if (!otpChallenge) throw errors.otpChallenge.notFound(id);

    this.#otpChallengesById[id] = {
      ...otpChallenge,
      revokedAt: revokedAt.toISOString(),
    };
  }

  public async getById(id: OtpChallengeId): Promise<OtpChallenge | null> {
    return this.#otpChallengesById[id] || null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetOtpChallengesByPurposeAndSubjectParams): Promise<OtpChallenge[]> {
    return values(this.#otpChallengesById).filter(
      (otpChallenge) =>
        otpChallenge.purpose === purpose &&
        equals(otpChallenge.subject, subject),
    );
  }
}
