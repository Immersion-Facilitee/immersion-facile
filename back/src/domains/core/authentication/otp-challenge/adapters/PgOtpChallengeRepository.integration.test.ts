import type { Pool } from "pg";
import {
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
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

      expectToEqual(
        await otpChallengeRepository.getById(emailOtpChallenge.id),
        emailOtpChallenge,
      );
      expectToEqual(
        await otpChallengeRepository.getById(smsOtpChallenge.id),
        smsOtpChallenge,
      );
    });

    it("fails to save an otp challenge if it already exists", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);

      await expectPromiseToFailWithError(
        otpChallengeRepository.save(emailOtpChallenge),
        errors.otpChallenge.alreadyExists(emailOtpChallenge.id),
      );
    });
  });

  describe("getById", () => {
    it("returns null when the otp challenge does not exist", async () => {
      expectToEqual(
        await otpChallengeRepository.getById(unknownOtpChallengeId),
        null,
      );
    });

    it("returns the otp challenge matching the id", async () => {
      await otpChallengeRepository.save(emailOtpChallenge);
      await otpChallengeRepository.save(smsOtpChallenge);

      expectToEqual(
        await otpChallengeRepository.getById(smsOtpChallenge.id),
        smsOtpChallenge,
      );
    });

    it("returns the otp challenge with usedAt when it exists", async () => {
      const otpChallengeWithUsedAt = new OtpChallengeDtoBuilder()
        .withUsedAt("2024-01-15T10:00:00.000Z")
        .build();
      await otpChallengeRepository.save(otpChallengeWithUsedAt);

      expectToEqual(
        await otpChallengeRepository.getById(otpChallengeWithUsedAt.id),
        otpChallengeWithUsedAt,
      );
    });
  });
});
