import { equals, values } from "ramda";
import { errors, type VisitorSession, type VisitorSessionId } from "shared";
import type {
  GetVisitorSessionsByPurposeAndSubjectParams,
  RevokeVisitorSessionParams,
  VisitorSessionRepository,
} from "../port/VisitorSessionRepository";

export class InMemoryVisitorSessionRepository
  implements VisitorSessionRepository
{
  #visitorSessionsById: Record<VisitorSessionId, VisitorSession> = {};

  // test purpose
  public get visitorSessions(): VisitorSession[] {
    return values(this.#visitorSessionsById);
  }

  public set visitorSessions(visitorSessions: VisitorSession[]) {
    this.#visitorSessionsById = visitorSessions.reduce<
      Record<VisitorSessionId, VisitorSession>
    >(
      (acc, visitorSession) => ({
        ...acc,
        [visitorSession.id]: visitorSession,
      }),
      {},
    );
  }

  public async save(visitorSession: VisitorSession): Promise<void> {
    if (this.#visitorSessionsById[visitorSession.id])
      throw errors.visitorSession.alreadyExists(visitorSession.id);

    this.#visitorSessionsById[visitorSession.id] = visitorSession;
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeVisitorSessionParams): Promise<void> {
    const visitorSession = this.#visitorSessionsById[id];

    if (!visitorSession) throw errors.visitorSession.notFound(id);

    this.#visitorSessionsById[id] = {
      ...visitorSession,
      revokedAt: revokedAt.toISOString(),
    };
  }

  public async getById(id: VisitorSessionId): Promise<VisitorSession | null> {
    return this.#visitorSessionsById[id] || null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetVisitorSessionsByPurposeAndSubjectParams): Promise<VisitorSession[]> {
    return values(this.#visitorSessionsById).filter(
      (visitorSession) =>
        visitorSession.purpose === purpose &&
        equals(visitorSession.subject, subject),
    );
  }
}
