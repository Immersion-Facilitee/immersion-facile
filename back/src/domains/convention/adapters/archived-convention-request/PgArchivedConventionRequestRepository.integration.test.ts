import type { Pool } from "pg";
import { ConnectedUserBuilder, expectToEqual } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { PgUserRepository } from "../../../core/authentication/connected-user/adapters/PgUserRepository";
import type { ArchivedConventionRequestEntity } from "../../entities/ArchivedConventionRequestEntity";
import { InMemoryArchivedConventionRequestRepository } from "./InMemoryArchivedConventionRequestRepository";
import { PgArchivedConventionRequestRepository } from "./PgArchivedConventionRequestRepository";

const adapters: ("InMemory" | "Pg")[] = ["Pg", "InMemory"];

describe.each(adapters)("%s ArchivedConventionRequestRepository", (adapter) => {
  let pool: Pool;
  let db: KyselyDb;
  let repository:
    | PgArchivedConventionRequestRepository
    | InMemoryArchivedConventionRequestRepository;

  const user = new ConnectedUserBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .buildUser();
  const createdAt = "2024-06-01T12:00:00.000Z";
  const updatedAt = createdAt;
  const immersionAppellation = {
    appellationCode: "11573",
    appellationLabel: "Boulanger / Boulangère",
    romeCode: "D1102",
    romeLabel: "Boulangerie - viennoiserie",
  };

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    repository =
      adapter === "Pg"
        ? new PgArchivedConventionRequestRepository(db)
        : new InMemoryArchivedConventionRequestRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("archived_convention_requests").execute();
      await db.deleteFrom("convention_templates").execute();
      await db.deleteFrom("users").execute();
      await new PgUserRepository(db).save(user);
    }
  });

  describe("save", () => {
    it("saves a request with conventionSearchMethod = withConventionId", async () => {
      const request: ArchivedConventionRequestEntity = {
        id: "11111111-1111-4111-8111-111111111111",
        userId: user.id,
        createdAt,
        updatedAt,
        status: "PENDING",
        conventionSearchMethod: "withConventionId",
        conventionId: "22222222-2222-4222-8222-222222222222",
        reason: "legalDispute",
      };

      await repository.save(request);

      expectToEqual(await repository.getById(request.id), request);
    });

    it("saves a request with conventionSearchMethod = withConventionDetails", async () => {
      const request: ArchivedConventionRequestEntity = {
        userId: user.id,
        createdAt,
        updatedAt,
        status: "PENDING",
        id: "33333333-3333-4333-8333-333333333333",
        conventionSearchMethod: "withConventionDetails",
        beneficiaryFirstName: "Jean",
        beneficiaryLastName: "Dupont",
        siret: "12345678901234",
        immersionDate: "2024-01-15",
        immersionAppellationCode: immersionAppellation.appellationCode,
        reason: "other",
        otherReason: "Motif personnalisé pour la demande",
      };

      await repository.save(request);

      expectToEqual(await repository.getById(request.id), request);
    });
  });

  describe("getById", () => {
    it("returns undefined when request does not exist", async () => {
      expectToEqual(
        await repository.getById("99999999-9999-4999-8999-999999999999"),
        undefined,
      );
    });
  });

  describe("update", () => {
    it("updates status and updatedAt", async () => {
      const request: ArchivedConventionRequestEntity = {
        id: "11111111-1111-4111-8111-111111111111",
        userId: user.id,
        createdAt,
        updatedAt,
        status: "PENDING",
        conventionSearchMethod: "withConventionId",
        conventionId: "22222222-2222-4222-8222-222222222222",
        reason: "legalDispute",
      };

      await repository.save(request);

      const nextUpdatedAt = "2024-07-01T08:00:00.000Z";
      await repository.update({
        id: request.id,
        status: "TREATED",
        updatedAt: nextUpdatedAt,
      });

      expectToEqual(await repository.getById(request.id), {
        ...request,
        status: "TREATED",
        updatedAt: nextUpdatedAt,
      });
    });
  });
});
