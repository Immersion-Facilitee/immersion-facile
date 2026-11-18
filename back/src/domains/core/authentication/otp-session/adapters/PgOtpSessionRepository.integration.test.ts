import type { Pool } from "pg";
import {
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type ManageConventionSubject,
  OtpSessionDtoBuilder,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../../config/pg/pgPool";
import { InMemoryOtpSessionRepository } from "./InMemoryOtpSessionRepository";
import { PgOtpSessionRepository } from "./PgOtpSessionRepository";

const unknownOtpSessionId = "99999999-9999-4999-a999-999999999999";
const otpSession = new OtpSessionDtoBuilder().build();
const otpSessionWithRevokedAt = new OtpSessionDtoBuilder()
  .withId("22222222-2222-4222-a222-222222222222")
  .withExpiresAt("2024-04-28T12:15:00.000Z")
  .withRevokedAt("2024-04-28T12:05:00.000Z")
  .build();

describe.each(["Pg", "InMemory"])("%s OtpSessionRepository", (adapter) => {
  let pool: Pool;
  let db: KyselyDb;
  let otpSessionRepository:
    | PgOtpSessionRepository
    | InMemoryOtpSessionRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    otpSessionRepository =
      adapter === "Pg"
        ? new PgOtpSessionRepository(db)
        : new InMemoryOtpSessionRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("otp_sessions").execute();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("save", () => {
    it("saves otp sessions", async () => {
      await otpSessionRepository.save(otpSession);
      await otpSessionRepository.save(otpSessionWithRevokedAt);

      expectToEqual(
        await otpSessionRepository.getById(otpSession.id),
        otpSession,
      );
      expectToEqual(
        await otpSessionRepository.getById(otpSessionWithRevokedAt.id),
        otpSessionWithRevokedAt,
      );
    });

    it("fails to save a otp session if it already exists", async () => {
      await otpSessionRepository.save(otpSession);

      await expectPromiseToFailWithError(
        otpSessionRepository.save(otpSession),
        errors.otpSession.alreadyExists(otpSession.id),
      );
    });
  });

  describe("revoke", () => {
    it("revokes only the targeted otp session", async () => {
      const otherOtpSession = new OtpSessionDtoBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .build();
      await otpSessionRepository.save(otpSession);
      await otpSessionRepository.save(otherOtpSession);

      await otpSessionRepository.revoke({
        id: otpSession.id,
        revokedAt: new Date("2024-04-28T10:45:00.000Z"),
      });

      expectToEqual(
        await otpSessionRepository.getById(otpSession.id),
        new OtpSessionDtoBuilder(otpSession)
          .withRevokedAt("2024-04-28T10:45:00.000Z")
          .build(),
      );
      expectToEqual(
        await otpSessionRepository.getById(otherOtpSession.id),
        otherOtpSession,
      );
    });

    it("fails to revoke a otp session that does not exist", async () => {
      await expectPromiseToFailWithError(
        otpSessionRepository.revoke({
          id: unknownOtpSessionId,
          revokedAt: new Date("2024-04-28T10:45:00.000Z"),
        }),
        errors.otpSession.notFound(unknownOtpSessionId),
      );
    });

    it("fails to revoke a otp session already revoked and keeps its first revocation date", async () => {
      await otpSessionRepository.save(otpSessionWithRevokedAt);

      await expectPromiseToFailWithError(
        otpSessionRepository.revoke({
          id: otpSessionWithRevokedAt.id,
          revokedAt: new Date("2024-04-28T12:10:00.000Z"),
        }),
        errors.otpSession.notFound(otpSessionWithRevokedAt.id),
      );
      expectToEqual(
        await otpSessionRepository.getById(otpSessionWithRevokedAt.id),
        otpSessionWithRevokedAt,
      );
    });
  });

  describe("getByPurposeAndSubject", () => {
    it("returns otp sessions with the same purpose and subject", async () => {
      const subject: ManageConventionSubject = {
        conventionId: "33333333-3333-4333-a333-333333333333",
        role: "beneficiary",
        emailHash: "beneficiary-email-hash",
      };
      const firstOtpSessionOfSubject = new OtpSessionDtoBuilder()
        .withId("44444444-4444-4444-a444-444444444444")
        .withSubject(subject)
        .withCreatedAt("2024-04-28T10:00:00.000Z")
        .build();
      const secondOtpSessionOfSubject = new OtpSessionDtoBuilder()
        .withId("55555555-5555-4555-a555-555555555555")
        .withSubject(subject)
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();
      const otpSessionOfOtherSubject = new OtpSessionDtoBuilder()
        .withId("66666666-6666-4666-a666-666666666666")
        .withSubject({ ...subject, role: "establishment-tutor" })
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();

      await otpSessionRepository.save(firstOtpSessionOfSubject);
      await otpSessionRepository.save(secondOtpSessionOfSubject);
      await otpSessionRepository.save(otpSessionOfOtherSubject);

      expectArraysToEqualIgnoringOrder(
        await otpSessionRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject,
        }),
        [firstOtpSessionOfSubject, secondOtpSessionOfSubject],
      );
    });

    it("returns an empty list when no otp session matches", async () => {
      await otpSessionRepository.save(otpSession);

      expectToEqual(
        await otpSessionRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject: { ...otpSession.subject, role: "beneficiary" },
        }),
        [],
      );
    });
  });

  describe("getById", () => {
    it("returns null when the otp session does not exist", async () => {
      expectToEqual(
        await otpSessionRepository.getById(unknownOtpSessionId),
        null,
      );
    });

    it("returns the otp session matching the id", async () => {
      await otpSessionRepository.save(otpSession);
      await otpSessionRepository.save(otpSessionWithRevokedAt);

      expectToEqual(
        await otpSessionRepository.getById(otpSessionWithRevokedAt.id),
        otpSessionWithRevokedAt,
      );
    });
  });
});
