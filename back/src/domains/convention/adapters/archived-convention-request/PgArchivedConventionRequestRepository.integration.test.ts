import type { Pool } from "pg";
import {
  type ArchivedConventionRequestReason,
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
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
    repository = new InMemoryArchivedConventionRequestRepository();
    adapter === "Pg"
      ? new PgArchivedConventionRequestRepository(db)
      : new InMemoryArchivedConventionRequestRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("archived_convention_requests").execute();
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
        handledAt: null,
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
        handledAt: null,
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

    it("throws when request details are incomplete", async () => {
      const id = "44444444-4444-4444-8444-444444444444";

      const request: ArchivedConventionRequestEntity = {
        userId: user.id,
        createdAt,
        id,
        conventionSearchMethod: "withConventionDetails",
        immersionAppellationCode: immersionAppellation.appellationCode,
        reason: "other",
      } as ArchivedConventionRequestEntity; //intentionally force as ArchivedConventionRequestEntity to test incomplete request

      await repository.save(request);

      await expectPromiseToFailWithError(
        repository.getById(id),
        errors.archivedConventionRequest.incomplete({ id }),
      );
    });

    it("throws when reason is unknown", async () => {
      const id = "55555555-5555-4555-8555-555555555555";
      const unknownReason = "not-a-valid-reason";

      const request: ArchivedConventionRequestEntity = {
        userId: user.id,
        createdAt,
        handledAt: null,
        id,
        conventionSearchMethod: "withConventionDetails",
        beneficiaryFirstName: "Jean",
        beneficiaryLastName: "Dupont",
        siret: "12345678901234",
        immersionDate: "2024-01-15",
        immersionAppellationCode: immersionAppellation.appellationCode,
        reason: unknownReason as ArchivedConventionRequestReason, //intentionally force as ArchivedConventionRequestEntity to test invalid reason
      };

      await repository.save(request);

      await expectPromiseToFailWithError(
        repository.getById(id),
        errors.archivedConventionRequest.unknownReason({
          reason: unknownReason,
        }),
      );
    });
  });
});
