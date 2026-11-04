import { type Selectable, sql } from "kysely";
import {
  errors,
  type OtpChallenge,
  type OtpChallengeId,
  otpChallengeSchema,
} from "shared";
import type { KyselyDb } from "../../../../../config/pg/kysely/kyselyUtils";
import type { Database } from "../../../../../config/pg/kysely/model/database";
import type {
  GetOtpChallengesByPurposeAndSubjectParams,
  OtpChallengeRepository,
  RevokeOtpChallengeParams,
} from "../port/OtpChallengeRepository";

export class PgOtpChallengeRepository implements OtpChallengeRepository {
  constructor(private transaction: KyselyDb) {}

  public async save(otpChallenge: OtpChallenge): Promise<void> {
    await this.transaction
      .insertInto("otp_challenges")
      .values({
        id: otpChallenge.id,
        purpose: otpChallenge.purpose,
        subject: JSON.stringify(otpChallenge.subject),
        channel: otpChallenge.channel,
        recipient: otpChallenge.recipient,
        code_hash: otpChallenge.codeHash,
        attempts: otpChallenge.attempts,
        expires_at: new Date(otpChallenge.expiresAt),
        used_at: otpChallenge.usedAt ? new Date(otpChallenge.usedAt) : null,
        revoked_at: otpChallenge.revokedAt
          ? new Date(otpChallenge.revokedAt)
          : null,
        created_at: new Date(otpChallenge.createdAt),
      })
      .execute()
      .catch((error) => {
        // https://www.postgresql.org/docs/current/errcodes-appendix.html
        if (error.code === "23505")
          throw errors.otpChallenge.alreadyExists(otpChallenge.id);

        throw error;
      });
  }

  public async revoke({
    id,
    revokedAt,
  }: RevokeOtpChallengeParams): Promise<void> {
    const result = await this.transaction
      .updateTable("otp_challenges")
      .set({ revoked_at: revokedAt })
      .where("id", "=", id)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0)
      throw errors.otpChallenge.notFound(id);
  }

  public async getById(id: OtpChallengeId): Promise<OtpChallenge | null> {
    const result = await this.transaction
      .selectFrom("otp_challenges")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return result ? toOtpChallenge(result) : null;
  }

  public async getByPurposeAndSubject({
    purpose,
    subject,
  }: GetOtpChallengesByPurposeAndSubjectParams): Promise<OtpChallenge[]> {
    const results = await this.transaction
      .selectFrom("otp_challenges")
      .selectAll()
      .where("purpose", "=", purpose)
      .where(sql<boolean>`subject = ${JSON.stringify(subject)}::jsonb`)
      .execute();

    return results.map(toOtpChallenge);
  }
}

const toOtpChallenge = (
  result: Selectable<Database["otp_challenges"]>,
): OtpChallenge =>
  otpChallengeSchema.parse({
    id: result.id,
    purpose: result.purpose,
    subject: result.subject,
    channel: result.channel,
    recipient: result.recipient,
    codeHash: result.code_hash,
    attempts: result.attempts,
    expiresAt: result.expires_at.toISOString(),
    usedAt: result.used_at ? result.used_at.toISOString() : null,
    revokedAt: result.revoked_at ? result.revoked_at.toISOString() : null,
    createdAt: result.created_at.toISOString(),
  });
