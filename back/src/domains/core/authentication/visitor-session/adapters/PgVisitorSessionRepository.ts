import { type Selectable, sql } from "kysely";
import {
  errors,
  type VisitorSession,
  type VisitorSessionId,
  visitorSessionSchema,
} from "shared";
import type { KyselyDb } from "../../../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../../../config/pg/kysely/model/database";
import type {
  GetVisitorSessionsByPurposeAndSubjectParams,
  RevokeVisitorSessionParams,
  VisitorSessionRepository,
} from "../port/VisitorSessionRepository";

export class PgVisitorSessionRepository implements VisitorSessionRepository {
  constructor(private transaction: KyselyDb) {}

  public async save(visitorSession: VisitorSession): Promise<void> {
    await this.transaction
      .insertInto("visitor_sessions")
      .values({
        id: visitorSession.id,
        purpose: visitorSession.purpose,
        subject: JSON.stringify(visitorSession.subject),
        expires_at: new Date(visitorSession.expiresAt),
        revoked_at: visitorSession.revokedAt
          ? new Date(visitorSession.revokedAt)
          : null,
        created_at: new Date(visitorSession.createdAt),
      })
      .execute()
      .catch((error) => {
        // https://www.postgresql.org/docs/current/errcodes-appendix.html
        if (error.code === "23505")
          throw errors.visitorSession.alreadyExists(visitorSession.id);

        throw error;
      });
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeVisitorSessionParams): Promise<void> {
    const result = await this.transaction
      .updateTable("visitor_sessions")
      .set({ revoked_at: revokedAt })
      .where("id", "=", id)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0)
      throw errors.visitorSession.notFound(id);
  }

  public async getById(id: VisitorSessionId): Promise<VisitorSession | null> {
    const result = await this.transaction
      .selectFrom("visitor_sessions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? toVisitorSession(result) : null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetVisitorSessionsByPurposeAndSubjectParams): Promise<VisitorSession[]> {
    const results = await this.transaction
      .selectFrom("visitor_sessions")
      .selectAll()
      .where("purpose", "=", purpose)
      .where(sql<boolean>`subject = ${JSON.stringify(subject)}::jsonb`)
      .execute();

    return results.map(toVisitorSession);
  }
}

const toVisitorSession = (
  result: Selectable<Database["visitor_sessions"]>,
): VisitorSession =>
  visitorSessionSchema.parse({
    id: result.id,
    purpose: result.purpose,
    subject: result.subject,
    expiresAt: result.expires_at.toISOString(),
    revokedAt: result.revoked_at ? result.revoked_at.toISOString() : null,
    createdAt: result.created_at.toISOString(),
  });
