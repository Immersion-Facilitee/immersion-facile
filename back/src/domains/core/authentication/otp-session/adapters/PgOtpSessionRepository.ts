import { type Selectable, sql } from "kysely";
import {
  errors,
  type OtpSession,
  type OtpSessionId,
  otpSessionSchema,
} from "shared";
import type { KyselyDb } from "../../../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../../../config/pg/kysely/model/database";
import type {
  GetOtpSessionsByPurposeAndSubjectParams,
  OtpSessionRepository,
  RevokeOtpSessionParams,
} from "../port/OtpSessionRepository";

export class PgOtpSessionRepository implements OtpSessionRepository {
  constructor(private transaction: KyselyDb) {}

  public async save(otpSession: OtpSession): Promise<void> {
    await this.transaction
      .insertInto("otp_sessions")
      .values({
        id: otpSession.id,
        purpose: otpSession.purpose,
        subject: JSON.stringify(otpSession.subject),
        expires_at: new Date(otpSession.expiresAt),
        revoked_at: otpSession.revokedAt
          ? new Date(otpSession.revokedAt)
          : null,
        created_at: new Date(otpSession.createdAt),
      })
      .execute()
      .catch((error) => {
        // https://www.postgresql.org/docs/current/errcodes-appendix.html
        if (error.code === "23505")
          throw errors.otpSession.alreadyExists(otpSession.id);

        throw error;
      });
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeOtpSessionParams): Promise<void> {
    const result = await this.transaction
      .updateTable("otp_sessions")
      .set({ revoked_at: revokedAt })
      .where("id", "=", id)
      .where("revoked_at", "is", null)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0)
      throw errors.otpSession.notFound(id);
  }

  public async getById(id: OtpSessionId): Promise<OtpSession | null> {
    const result = await this.transaction
      .selectFrom("otp_sessions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? toOtpSession(result) : null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetOtpSessionsByPurposeAndSubjectParams): Promise<OtpSession[]> {
    const results = await this.transaction
      .selectFrom("otp_sessions")
      .selectAll()
      .where("purpose", "=", purpose)
      .where(sql<boolean>`subject = ${JSON.stringify(subject)}::jsonb`)
      .execute();

    return results.map(toOtpSession);
  }
}

const toOtpSession = (
  result: Selectable<Database["otp_sessions"]>,
): OtpSession =>
  otpSessionSchema.parse({
    id: result.id,
    purpose: result.purpose,
    subject: result.subject,
    expiresAt: result.expires_at.toISOString(),
    revokedAt: result.revoked_at ? result.revoked_at.toISOString() : null,
    createdAt: result.created_at.toISOString(),
  });
