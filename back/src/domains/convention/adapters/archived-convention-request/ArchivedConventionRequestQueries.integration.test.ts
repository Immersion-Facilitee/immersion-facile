import type { Pool } from "pg";
import { ConnectedUserBuilder, executeInSequence, expectToEqual } from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { PgUserRepository } from "../../../core/authentication/connected-user/adapters/PgUserRepository";
import type { ArchivedConventionRequestEntity } from "../../entities/ArchivedConventionRequestEntity";
import type { ArchivedConventionRequestToReviewList } from "../../ports/ArchivedConventionRequestQueries";
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
        handledAt: null,
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const newRequest: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2026-01-01").toISOString(),
        handledAt: null,
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const expectedResults = [oldRequest, newRequest];

      if (queries instanceof PgArchivedConventionRequestQueries) {
        await saveEntitiesInRepo(db, expectedResults);
      } else {
        queries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
          expectedResults.map(({ id, reason, userId, createdAt }) => ({
            id,
            reason,
            userId,
            createdAt,
          }));
      }

      expectToEqual(
        await queries.getFirstOldestArchivedConventionRequestToReviewList(),
        expectedResults.map(({ id, reason, userId, createdAt }) => ({
          id,
          reason,
          userId,
          createdAt,
        })),
      );
    });

    it("do not get entities already handled", async () => {
      const oldRequestAlreadyHandled: ArchivedConventionRequestEntity = {
        id: uuid(),
        userId: user.id,
        createdAt: new Date("2022-01-01").toISOString(),
        handledAt: new Date("2026-01-01").toISOString(),
        conventionSearchMethod: "withConventionId",
        conventionId: uuid(),
        reason: "legalDispute",
      };

      const expectedResults: ArchivedConventionRequestToReviewList = [];

      if (queries instanceof PgArchivedConventionRequestQueries) {
        await saveEntitiesInRepo(db, [oldRequestAlreadyHandled]);
      } else {
        queries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
          expectedResults;
      }

      expectToEqual(
        await queries.getFirstOldestArchivedConventionRequestToReviewList(),
        expectedResults,
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
