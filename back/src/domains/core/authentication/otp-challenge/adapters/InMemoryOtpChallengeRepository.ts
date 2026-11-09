import { equals, values } from "ramda";
import { errors, type OtpChallenge, type OtpChallengeId } from "shared";
import type {
  GetOtpChallengesByPurposeAndSubjectParams,
  MarkOtpChallengeAsUsedParams,
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

    if (isOtpChallengeActive(otpChallenge) && this.#findActive(otpChallenge))
      throw errors.otpChallenge.activeChallengeAlreadyExists();

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

  public async markAsUsed({
    id,
    usedAt,
  }: MarkOtpChallengeAsUsedParams): Promise<void> {
    const otpChallenge = this.#otpChallengesById[id];

    if (!otpChallenge || otpChallenge.usedAt !== null)
      throw errors.otpChallenge.notFound(id);

    this.#otpChallengesById[id] = {
      ...otpChallenge,
      usedAt: usedAt.toISOString(),
    };
  }

  public async incrementAttempts(id: OtpChallengeId): Promise<void> {
    const otpChallenge = this.#otpChallengesById[id];

    if (!otpChallenge) throw errors.otpChallenge.notFound(id);

    this.#otpChallengesById[id] = {
      ...otpChallenge,
      attempts: otpChallenge.attempts + 1,
    };
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

  public async getActiveByPurposeAndSubject(
    params: GetOtpChallengesByPurposeAndSubjectParams,
  ): Promise<OtpChallenge | null> {
    return this.#findActive(params) ?? null;
  }

  #findActive({
    purpose,
    subject,
  }: GetOtpChallengesByPurposeAndSubjectParams): OtpChallenge | undefined {
    return values(this.#otpChallengesById).find(
      (otpChallenge) =>
        isOtpChallengeActive(otpChallenge) &&
        otpChallenge.purpose === purpose &&
        equals(otpChallenge.subject, subject),
    );
  }
}

const isOtpChallengeActive = ({ usedAt, revokedAt }: OtpChallenge): boolean =>
  usedAt === null && revokedAt === null;
