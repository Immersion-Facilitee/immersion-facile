import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  type ConventionTemplate,
  expectToEqual,
  type SiretDto,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeUniqueUserForTest } from "../../../utils/user";
import { PgAgencyRepository } from "../../agency/adapters/PgAgencyRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { PgBannedEstablishmentRepository } from "../../establishment/adapters/PgBannedEstablishmentRepository";
import { PgConventionTemplateQueries } from "./PgConventionTemplateQueries";

describe("PgConventionTemplateQueries", () => {
  let pool: Pool;
  let pgConventionTemplateQueries: PgConventionTemplateQueries;
  let db: KyselyDb;
  const agency = new AgencyDtoBuilder().withId(uuid()).build();
  const validator = makeUniqueUserForTest(uuid());
  const conventionTemplate: ConventionTemplate = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Mon modèle",
    internshipKind: "immersion",
    agencyId: agency.id,
    userId: validator.id,
    remoteWorkMode: "FULL_REMOTE",
  };
  const now = "2024-10-08T00:00:00.000Z";

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    pgConventionTemplateQueries = new PgConventionTemplateQueries(db);
  });

  beforeEach(async () => {
    await db.deleteFrom("banned_establishments").execute();
    await db.deleteFrom("conventions").execute();
    await db.deleteFrom("convention_drafts").execute();
    await db.deleteFrom("users__agencies").execute();
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("agency_groups__agencies").execute();
    await db.deleteFrom("agencies").execute();
    await db.deleteFrom("users").execute();

    await new PgUserRepository(db).save(validator);
    await new PgAgencyRepository(db).insert(
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("get", () => {
    it("returns empty array when ids do not exist", async () => {
      const unknownConventionTemplateId = uuid();
      const result = await pgConventionTemplateQueries.get({
        ids: [unknownConventionTemplateId],
      });

      expect(result).toHaveLength(0);
    });

    it("does not return convention templates for banned establishments", async () => {
      const bannedEstablishmentSiret: SiretDto = "78000403200019";

      await new PgBannedEstablishmentRepository(db).banEstablishment({
        siret: bannedEstablishmentSiret,
        establishmentBannishmentJustification: "whatever",
      });
      const conventionTemplateId = uuid();
      const conventionTemplateForBannedEstablishment: ConventionTemplate = {
        ...conventionTemplate,
        id: conventionTemplateId,
        name: "Template for banned establishment",
        userId: validator.id,
        siret: bannedEstablishmentSiret,
      };
      pgConventionTemplateQueries.upsert(
        conventionTemplateForBannedEstablishment,
        now,
      );
      const result = await pgConventionTemplateQueries.get({
        ids: [conventionTemplateId],
      });

      expect(result).toHaveLength(0);
    });

    it("returns empty array when user has no templates", async () => {
      const result = await pgConventionTemplateQueries.get({
        userIds: [validator.id],
      });

      expectToEqual(result, []);
    });

    it("returns only templates for the given ids", async () => {
      const template1: ConventionTemplate = {
        ...conventionTemplate,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Template 1",
        userId: validator.id,
      };
      const template2: ConventionTemplate = {
        ...conventionTemplate,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Template 2",
        userId: validator.id,
      };
      await pgConventionTemplateQueries.upsert(template1, now);
      await pgConventionTemplateQueries.upsert(template2, now);

      const result = await pgConventionTemplateQueries.get({
        ids: [template1.id],
      });

      expectToEqual(result, [{ ...template1, updatedAt: now }]);
    });

    it("returns only templates for the given userIds", async () => {
      const otherUser = makeUniqueUserForTest(uuid());
      await new PgUserRepository(db).save(otherUser);

      const templateForValidator: ConventionTemplate = {
        ...conventionTemplate,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Validator template",
        userId: validator.id,
      };
      const templateForOther: ConventionTemplate = {
        ...conventionTemplate,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Other user template",
        userId: otherUser.id,
      };
      await pgConventionTemplateQueries.upsert(templateForValidator, now);
      await pgConventionTemplateQueries.upsert(templateForOther, now);

      const result = await pgConventionTemplateQueries.get({
        userIds: [validator.id],
      });

      expectToEqual(result, [{ ...templateForValidator, updatedAt: now }]);
    });

    it("returns templates for the given id and userId", async () => {
      const template1: ConventionTemplate = {
        ...conventionTemplate,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Template 1",
        userId: validator.id,
      };
      const template2: ConventionTemplate = {
        ...conventionTemplate,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Template 2",
        userId: validator.id,
      };
      await pgConventionTemplateQueries.upsert(template1, now);
      await pgConventionTemplateQueries.upsert(template2, now);

      const result = await pgConventionTemplateQueries.get({
        ids: [template1.id],
        userIds: [validator.id],
      });

      expectToEqual(result, [{ ...template1, updatedAt: now }]);
    });
  });

  describe("upsert", () => {
    it("creates a row when id does not exist", async () => {
      await pgConventionTemplateQueries.upsert(conventionTemplate, now);

      const result = await pgConventionTemplateQueries.get({
        ids: [conventionTemplate.id],
      });

      expectToEqual(result, [
        {
          ...conventionTemplate,
          updatedAt: now,
        },
      ]);
    });

    it("updates the row when id already exists", async () => {
      await pgConventionTemplateQueries.upsert(conventionTemplate, now);

      const updatedConventionTemplate: ConventionTemplate = {
        ...conventionTemplate,
        name: "Updated name",
        signatories: {
          beneficiary: {
            role: "beneficiary",
            email: "beneficiary@example.com",
            firstName: "Marie",
            lastName: "Martin",
          },
          establishmentRepresentative: {
            role: "establishment-representative",
            email: "rep@example.com",
            firstName: "Pierre",
            lastName: "Bernard",
          },
        },
      };
      await pgConventionTemplateQueries.upsert(updatedConventionTemplate, now);

      const result = await pgConventionTemplateQueries.get({
        ids: [conventionTemplate.id],
      });
      expectToEqual(result, [{ ...updatedConventionTemplate, updatedAt: now }]);
    });
  });

  describe("delete", () => {
    it("removes the row when id exists", async () => {
      await pgConventionTemplateQueries.upsert(conventionTemplate, now);

      const deletedId = await pgConventionTemplateQueries.delete(
        conventionTemplate.id,
      );

      const result = await pgConventionTemplateQueries.get({
        ids: [conventionTemplate.id],
      });
      expect(result).toHaveLength(0);
      expect(deletedId).toBe(conventionTemplate.id);
    });

    it("does nothing when id does not exist", async () => {
      await pgConventionTemplateQueries.upsert(conventionTemplate, now);

      const deletedId = await pgConventionTemplateQueries.delete(
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      );

      const result = await pgConventionTemplateQueries.get({
        userIds: [validator.id],
      });
      expect(deletedId).toBeNull();
      expectToEqual(result, [{ ...conventionTemplate, updatedAt: now }]);
    });
  });
});
