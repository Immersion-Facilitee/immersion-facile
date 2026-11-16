import { equals, values } from "ramda";
import { errors, type OtpSession, type OtpSessionId } from "shared";
import type {
  GetOtpSessionsByPurposeAndSubjectParams,
  OtpSessionRepository,
  RevokeOtpSessionParams,
} from "../port/OtpSessionRepository";

export class InMemoryOtpSessionRepository implements OtpSessionRepository {
  #otpSessionsById: Record<OtpSessionId, OtpSession> = {};

  // test purpose
  public get otpSessions(): OtpSession[] {
    return values(this.#otpSessionsById);
  }

  public set otpSessions(otpSessions: OtpSession[]) {
    this.#otpSessionsById = otpSessions.reduce<
      Record<OtpSessionId, OtpSession>
    >(
      (acc, otpSession) => ({
        ...acc,
        [otpSession.id]: otpSession,
      }),
      {},
    );
  }

  public async save(otpSession: OtpSession): Promise<void> {
    if (this.#otpSessionsById[otpSession.id])
      throw errors.otpSession.alreadyExists(otpSession.id);

    this.#otpSessionsById[otpSession.id] = otpSession;
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeOtpSessionParams): Promise<void> {
    const otpSession = this.#otpSessionsById[id];

    if (!otpSession || otpSession.revokedAt !== null)
      throw errors.otpSession.notFound(id);

    this.#otpSessionsById[id] = {
      ...otpSession,
      revokedAt: revokedAt.toISOString(),
    };
  }

  public async getById(id: OtpSessionId): Promise<OtpSession | null> {
    return this.#otpSessionsById[id] || null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetOtpSessionsByPurposeAndSubjectParams): Promise<OtpSession[]> {
    return values(this.#otpSessionsById).filter(
      (otpSession) =>
        otpSession.purpose === purpose && equals(otpSession.subject, subject),
    );
  }
}
