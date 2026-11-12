import type { Pool } from "pg";
import {
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type ManageConventionSubject,
  VisitorSessionDtoBuilder,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../../config/pg/pgPool";
import { InMemoryVisitorSessionRepository } from "./InMemoryVisitorSessionRepository";
import { PgVisitorSessionRepository } from "./PgVisitorSessionRepository";

const unknownVisitorSessionId = "99999999-9999-4999-a999-999999999999";
const visitorSession = new VisitorSessionDtoBuilder().build();
const visitorSessionWithRevokedAt = new VisitorSessionDtoBuilder()
  .withId("22222222-2222-4222-a222-222222222222")
  .withExpiresAt("2024-04-28T12:15:00.000Z")
  .withRevokedAt("2024-04-28T12:05:00.000Z")
  .build();

describe.each(["Pg", "InMemory"])("%s VisitorSessionRepository", (adapter) => {
  let pool: Pool;
  let db: KyselyDb;
  let visitorSessionRepository:
    | PgVisitorSessionRepository
    | InMemoryVisitorSessionRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    visitorSessionRepository =
      adapter === "Pg"
        ? new PgVisitorSessionRepository(db)
        : new InMemoryVisitorSessionRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("visitor_sessions").execute();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("save", () => {
    it("saves visitor sessions", async () => {
      await visitorSessionRepository.save(visitorSession);
      await visitorSessionRepository.save(visitorSessionWithRevokedAt);

      expectToEqual(
        await visitorSessionRepository.getById(visitorSession.id),
        visitorSession,
      );
      expectToEqual(
        await visitorSessionRepository.getById(visitorSessionWithRevokedAt.id),
        visitorSessionWithRevokedAt,
      );
    });

    it("fails to save a visitor session if it already exists", async () => {
      await visitorSessionRepository.save(visitorSession);

      await expectPromiseToFailWithError(
        visitorSessionRepository.save(visitorSession),
        errors.visitorSession.alreadyExists(visitorSession.id),
      );
    });
  });

  describe("revoke", () => {
    it("revokes an existing visitor session", async () => {
      await visitorSessionRepository.save(visitorSession);

      await visitorSessionRepository.revoke({
        id: visitorSession.id,
        revokedAt: new Date("2024-04-28T10:45:00.000Z"),
      });

      expectToEqual(
        await visitorSessionRepository.getById(visitorSession.id),
        new VisitorSessionDtoBuilder(visitorSession)
          .withRevokedAt("2024-04-28T10:45:00.000Z")
          .build(),
      );
    });

    it("fails to revoke a visitor session that does not exist", async () => {
      await expectPromiseToFailWithError(
        visitorSessionRepository.revoke({
          id: unknownVisitorSessionId,
          revokedAt: new Date("2024-04-28T10:45:00.000Z"),
        }),
        errors.visitorSession.notFound(unknownVisitorSessionId),
      );
    });
  });

  describe("getByPurposeAndSubject", () => {
    it("returns visitor sessions with the same purpose and subject", async () => {
      const subject: ManageConventionSubject = {
        conventionId: "33333333-3333-4333-a333-333333333333",
        role: "beneficiary",
        emailHash: "beneficiary-email-hash",
      };
      const firstVisitorSessionOfSubject = new VisitorSessionDtoBuilder()
        .withId("44444444-4444-4444-a444-444444444444")
        .withSubject(subject)
        .withCreatedAt("2024-04-28T10:00:00.000Z")
        .build();
      const secondVisitorSessionOfSubject = new VisitorSessionDtoBuilder()
        .withId("55555555-5555-4555-a555-555555555555")
        .withSubject(subject)
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();
      const visitorSessionOfOtherSubject = new VisitorSessionDtoBuilder()
        .withId("66666666-6666-4666-a666-666666666666")
        .withSubject({ ...subject, role: "establishment-tutor" })
        .withCreatedAt("2024-04-28T11:30:00.000Z")
        .build();

      await visitorSessionRepository.save(firstVisitorSessionOfSubject);
      await visitorSessionRepository.save(secondVisitorSessionOfSubject);
      await visitorSessionRepository.save(visitorSessionOfOtherSubject);

      expectArraysToEqualIgnoringOrder(
        await visitorSessionRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject,
        }),
        [firstVisitorSessionOfSubject, secondVisitorSessionOfSubject],
      );
    });

    it("returns an empty list when no visitor session matches", async () => {
      await visitorSessionRepository.save(visitorSession);

      expectToEqual(
        await visitorSessionRepository.getByPurposeAndSubject({
          purpose: "manageConvention",
          subject: { ...visitorSession.subject, role: "beneficiary" },
        }),
        [],
      );
    });
  });

  describe("getById", () => {
    it("returns null when the visitor session does not exist", async () => {
      expectToEqual(
        await visitorSessionRepository.getById(unknownVisitorSessionId),
        null,
      );
    });

    it("returns the visitor session matching the id", async () => {
      await visitorSessionRepository.save(visitorSession);
      await visitorSessionRepository.save(visitorSessionWithRevokedAt);

      expectToEqual(
        await visitorSessionRepository.getById(visitorSessionWithRevokedAt.id),
        visitorSessionWithRevokedAt,
      );
    });
  });
});
