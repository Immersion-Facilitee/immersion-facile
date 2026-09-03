import type { Pool } from "pg";
import {
  ConnectedUserBuilder,
  errors,
  executeInSequence,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { PgUserRepository } from "../../../core/authentication/connected-user/adapters/PgUserRepository";
import type { ArchivedConventionRequestEntity } from "../../entities/ArchivedConventionRequestEntity";
import type { ArchivedConventionRequestToReviewListItem } from "../../ports/ArchivedConventionRequestQueries";
import { InMemoryArchivedConventionRequestQueries } from "./InMemoryArchivedConventionRequestQueries";
import { PgArchivedConventionRequestQueries } from "./PgArchivedConventionRequestQueries";
import { PgArchivedConventionRequestRepository } from "./PgArchivedConventionRequestRepository";

const adapters: ("InMemory" | "Pg")[] = ["Pg", "InMemory"];

describe.each(adapters)("%s ArchivedConventionRequestQueries", (adapter) => {
  const user = new ConnectedUserBuilder().withId(uuid()).buildUser();
  let pool: Pool;
  let db: KyselyDb;
  let queries:
    | PgArchivedConventionRequestQueries
    | InMemoryArchivedConventionRequestQueries;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    queries =
      adapter === "Pg"
        ? new PgArchivedConventionRequestQueries(db)
        : new InMemoryArchivedConventionRequestQueries();

    if (adapter === "Pg") {
      await db.deleteFrom("archived_convention_requests").execute();
      await db.deleteFrom("convention_templates").execute();
      await db.deleteFrom("users").execute();
      await new PgUserRepository(db).save(user);
    }
  });

  describe("getFirstOldestArchivedConventionRequestToReviewList", () => {
    it("get entities sorted by created at date", async () => {
      const oldRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2022-01-01").toISOString(),
        updatedAt: new Date("2022-01-01").toISOString(),
        status: "PENDING",
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const newRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2026-01-01").toISOString(),
        updatedAt: new Date("2026-01-01").toISOString(),
        status: "PENDING",
        conventionSearchMethod: "withConventionDetails",
        beneficiaryFirstName: "Jean",
        beneficiaryLastName: "Dupont",
        siret: "12345678901234",
        immersionDate: "2024-01-15",
        immersionAppellationCode: "11573",
        reason: "other",
        otherReason: "Motif personnalisé pour la demande",
      };

      const expectedResults: ArchivedConventionRequestToReviewListItem[] = [
        {
          id: oldRequest.id,
          userId: oldRequest.userId,
          createdAt: oldRequest.createdAt,
          conventionSearchMethod: "withConventionId",
          conventionId: oldRequest.conventionId,
          reason: "legalDispute",
        },
        {
          id: newRequest.id,
          userId: newRequest.userId,
          createdAt: newRequest.createdAt,
          conventionSearchMethod: "withConventionDetails",
          beneficiaryFirstName: newRequest.beneficiaryFirstName,
          beneficiaryLastName: newRequest.beneficiaryLastName,
          siret: newRequest.siret,
          immersionDate: newRequest.immersionDate,
          reason: "other",
          otherReason: "Motif personnalisé pour la demande",
        },
      ];

      if (queries instanceof PgArchivedConventionRequestQueries) {
        await saveEntitiesInRepo(db, [oldRequest, newRequest]);
      } else {
        queries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
          expectedResults;
      }

      expectToEqual(
        await queries.getFirstOldestArchivedConventionRequestToReviewList(),
        expectedResults,
      );
    });

    it("does not return TREATED or REJECTED requests", async () => {
      const pendingRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2022-01-01").toISOString(),
        updatedAt: new Date("2022-01-01").toISOString(),
        status: "PENDING",
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const treatedRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2023-01-01").toISOString(),
        updatedAt: new Date("2026-01-01").toISOString(),
        status: "TREATED",
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const refusedRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2026-01-01").toISOString(),
        status: "REJECTED",
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const expectedResults: ArchivedConventionRequestToReviewListItem[] = [
        {
          id: pendingRequest.id,
          userId: pendingRequest.userId,
          createdAt: pendingRequest.createdAt,
          conventionSearchMethod: "withConventionId",
          conventionId: pendingRequest.conventionId,
          reason: "legalDispute",
        },
      ];

      if (queries instanceof PgArchivedConventionRequestQueries) {
        await saveEntitiesInRepo(db, [
          pendingRequest,
          treatedRequest,
          refusedRequest,
        ]);
      } else {
        queries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
          expectedResults;
      }

      expectToEqual(
        await queries.getFirstOldestArchivedConventionRequestToReviewList(),
        expectedResults,
      );
    });

    if (adapter === "Pg")
      it("throws when request details are incomplete", async () => {
        const id = uuid();

        await db
          .insertInto("archived_convention_requests")
          .values({
            id,
            user_id: user.id,
            created_at: new Date("2022-01-01"),
            updated_at: new Date("2022-01-01"),
            status: "PENDING",
            reason: "legalDispute",
          })
          .execute();

        await expectPromiseToFailWithError(
          queries.getFirstOldestArchivedConventionRequestToReviewList(),
          errors.archivedConventionRequest.incomplete({ id }),
        );
      });
  });
});

async function saveEntitiesInRepo(
  db: KyselyDb,
  entities: ArchivedConventionRequestEntity[],
) {
  const repo = new PgArchivedConventionRequestRepository(db);
  await executeInSequence(entities, (entity) => repo.save(entity));
}
