import type { Pool } from "pg";
import {
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type ManageConventionSubject,
  OtpChallengeDtoBuilder,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../../config/pg/pgPool";
import { InMemoryOtpChallengeRepository } from "./InMemoryOtpChallengeRepository";
import { PgOtpChallengeRepository } from "./PgOtpChallengeRepository";

const unknownOtpChallengeId = "99999999-9999-4999-a999-999999999999";
const emailOtpChallenge = new OtpChallengeDtoBuilder().build();
const smsOtpChallenge = new OtpChallengeDtoBuilder()
  .withId("22222222-2222-4222-a222-222222222222")
  .withChannel("sms")
  .withRecipient("+33612345678")
  .withAttempts(2)
  .withExpiresAt("2024-04-28T12:15:00.000Z")
  .withUsedAt("2024-04-28T12:05:00.000Z")
  .build();

describe.each(["Pg", "InMemory"])("%s OtpChallengeRepository", (adapter) => {
  let pool: Pool;
  let db: KyselyDb;
  let otpChallengeRepository:
    | PgOtpChallengeRepository
    | InMemoryOtpChallengeRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    otpChallengeRepository =
      adapter === "Pg"
        ? new PgOtpChallengeRepository(db)
        : new InMemoryOtpChallengeRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("otp_challenges").execute();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("save", () => {
    it("saves email and sms otp challenges", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);
      await otpChallengeRepository.save(smsOtpChallenge);

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        [emailOtpChallenge, smsOtpChallenge],
      );
    });

    it("fails to save an otp challenge if it already exists", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);

      await expectPromiseToFailWithError(
        otpChallengeRepository.save(emailOtpChallenge),
        errors.otpChallenge.alreadyExists(emailOtpChallenge.id),
      );
    });

    it("fails to save an active otp challenge if another one is active for the same purpose and subject", async () => {
      const otherActiveOtpChallenge = new OtpChallengeDtoBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .build();
      await otpChallengeRepository.save(emailOtpChallenge);

      await expectPromiseToFailWithError(
        otpChallengeRepository.save(otherActiveOtpChallenge),
        errors.otpChallenge.activeChallengeAlreadyExists(),
      );
    });

    it("saves an active otp challenge when the others of the same purpose and subject are used or revoked", async () => {
      const revokedOtpChallenge = new OtpChallengeDtoBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .withRevokedAt("2024-04-28T12:01:00.000Z")
        .build();
      await otpChallengeRepository.save(smsOtpChallenge);
      await otpChallengeRepository.save(revokedOtpChallenge);
      await otpChallengeRepository.save(emailOtpChallenge);

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        [smsOtpChallenge, revokedOtpChallenge, emailOtpChallenge],
      );
    });
  });

  describe("revoke", () => {
    it("revokes only the targeted otp challenge", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);
      await otpChallengeRepository.save(smsOtpChallenge);

      await otpChallengeRepository.revoke({
        id: emailOtpChallenge.id,
        revokedAt: new Date("2024-04-28T10:45:00.000Z"),
      });

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        [
          { ...emailOtpChallenge, revokedAt: "2024-04-28T10:45:00.000Z" },
          smsOtpChallenge,
        ],
      );
    });

    it("fails to revoke an otp challenge that does not exist", async () => {
      await expectPromiseToFailWithError(
        otpChallengeRepository.revoke({
          id: unknownOtpChallengeId,
          revokedAt: new Date("2024-04-28T10:45:00.000Z"),
        }),
        errors.otpChallenge.notFound(unknownOtpChallengeId),
      );
    });
  });

  describe("markAsUsed", () => {
    it("marks only the targeted otp challenge as used", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);
      await otpChallengeRepository.save(smsOtpChallenge);

      await otpChallengeRepository.markAsUsed({
        id: emailOtpChallenge.id,
        usedAt: new Date("2024-04-28T10:45:00.000Z"),
      });

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        [
          { ...emailOtpChallenge, usedAt: "2024-04-28T10:45:00.000Z" },
          smsOtpChallenge,
        ],
      );
    });

    it("fails to mark as used an otp challenge that does not exist", async () => {
      await expectPromiseToFailWithError(
        otpChallengeRepository.markAsUsed({
          id: unknownOtpChallengeId,
          usedAt: new Date("2024-04-28T10:45:00.000Z"),
        }),
        errors.otpChallenge.notFound(unknownOtpChallengeId),
      );
    });

    it("fails to mark as used an otp challenge already used", async () => {
      await otpChallengeRepository.save(smsOtpChallenge);

      await expectPromiseToFailWithError(
        otpChallengeRepository.markAsUsed({
          id: smsOtpChallenge.id,
          usedAt: new Date("2024-04-28T12:10:00.000Z"),
        }),
        errors.otpChallenge.notFound(smsOtpChallenge.id),
      );

      expectToEqual(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: smsOtpChallenge.purpose,
          subject: smsOtpChallenge.subject,
        }),
        [smsOtpChallenge],
      );
    });
  });

  describe("incrementAttempts", () => {
    it("increments attempts of only the targeted otp challenge on each call", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);
      await otpChallengeRepository.save(smsOtpChallenge);

      await otpChallengeRepository.incrementAttempts(smsOtpChallenge.id);
      await otpChallengeRepository.incrementAttempts(smsOtpChallenge.id);

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        [emailOtpChallenge, { ...smsOtpChallenge, attempts: 4 }],
      );
    });

    it("fails to increment attempts of an otp challenge that does not exist", async () => {
      await expectPromiseToFailWithError(
        otpChallengeRepository.incrementAttempts(unknownOtpChallengeId),
        errors.otpChallenge.notFound(unknownOtpChallengeId),
      );
    });
  });

  describe("getByPurposeAndSubject", () => {
    it("returns otp challenges with the same purpose and subject", async () => {
      const subject: ManageConventionSubject = {
        conventionId: "33333333-3333-4333-a333-333333333333",
        role: "beneficiary",
        emailHash: "beneficiary-email-hash",
      };
      const emailOtpChallengeOfSubject = new OtpChallengeDtoBuilder()
        .withId("44444444-4444-4444-a444-444444444444")
        .withSubject(subject)
        .withCreatedAt("2024-04-28T10:00:00.000Z")
        .withRevokedAt("2024-04-28T11:30:00.000Z")
        .build();
      const smsOtpChallengeOfSubject = new OtpChallengeDtoBuilder()
        .withId("55555555-5555-4555-a555-555555555555")
        .withSubject(subject)
        .withChannel("sms")
        .withRecipient("+33612345678")
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();
      const otpChallengeOfOtherSubject = new OtpChallengeDtoBuilder()
        .withId("66666666-6666-4666-a666-666666666666")
        .withSubject({ ...subject, role: "establishment-tutor" })
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();

      await otpChallengeRepository.save(emailOtpChallengeOfSubject);
      await otpChallengeRepository.save(smsOtpChallengeOfSubject);
      await otpChallengeRepository.save(otpChallengeOfOtherSubject);

      expectArraysToEqualIgnoringOrder(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject,
        }),
        [emailOtpChallengeOfSubject, smsOtpChallengeOfSubject],
      );
    });

    it("returns an empty list when no otp challenge matches", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);

      expectToEqual(
        await otpChallengeRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject: { ...emailOtpChallenge.subject, role: "beneficiary" },
        }),
        [],
      );
    });
  });

  describe("getActiveByPurposeAndSubject", () => {
    it("returns the otp challenge neither used nor revoked of the same purpose and subject, even if expired", async () => {
      const revokedOtpChallenge = new OtpChallengeDtoBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .withRevokedAt("2024-04-28T12:01:00.000Z")
        .build();
      const activeOtpChallengeOfOtherSubject = new OtpChallengeDtoBuilder()
        .withId("44444444-4444-4444-a444-444444444444")
        .withSubject({ ...emailOtpChallenge.subject, role: "beneficiary" })
        .build();
      await otpChallengeRepository.save(smsOtpChallenge);
      await otpChallengeRepository.save(revokedOtpChallenge);
      await otpChallengeRepository.save(activeOtpChallengeOfOtherSubject);
      await otpChallengeRepository.save(emailOtpChallenge);

      expectToEqual(
        await otpChallengeRepository.getActiveByPurposeAndSubject({
          purpose: emailOtpChallenge.purpose,
          subject: emailOtpChallenge.subject,
        }),
        emailOtpChallenge,
      );
    });

    it("returns null when every otp challenge of the same purpose and subject is used or revoked", async () => {
      const revokedOtpChallenge = new OtpChallengeDtoBuilder()
        .withId("33333333-3333-4333-a333-333333333333")
        .withRevokedAt("2024-04-28T12:01:00.000Z")
        .build();
      await otpChallengeRepository.save(smsOtpChallenge);
      await otpChallengeRepository.save(revokedOtpChallenge);

      expectToEqual(
        await otpChallengeRepository.getActiveByPurposeAndSubject({
          purpose: smsOtpChallenge.purpose,
          subject: smsOtpChallenge.subject,
        }),
        null,
      );
    });
  });
});
