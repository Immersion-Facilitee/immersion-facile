import type { Pool } from "pg";
import {
  expectObjectInArrayToMatch,
  expectObjectsToMatch,
  expectToEqual,
  type GroupInfo,
  type GroupOptions,
  UserBuilder,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import type { GroupEntity } from "../entities/GroupEntity";
import { PgGroupRepository } from "./PgGroupRepository";

describe("PgEstablishmentGroupRepository", () => {
  const groupOptions: GroupOptions = {
    heroHeader: {
      title: "My hero header title",
      description: "My hero header description",
      logoUrl: "https://my-logo-url.com",
    },
  };

  const siret1 = "11112222111122";
  const siret2 = "33334444333344";

  const carrefourGroup: GroupInfo = {
    slug: "carrefour",
    name: "Carrefour",
    options: groupOptions,
  };
  const carrefourGroupEntity: GroupEntity = {
    ...carrefourGroup,
    sirets: [siret1, siret2],
  };

  const laMieCalineGroup: GroupEntity = {
    slug: "l-amie-caline",
    name: "L'amie caline",
    sirets: [],
    options: groupOptions,
  };

  const user = new UserBuilder().withId(uuid()).build();

  let pool: Pool;
  let db: KyselyDb;
  let pgEstablishmentGroupRepository: PgGroupRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    pgEstablishmentGroupRepository = new PgGroupRepository(db);
  });

  beforeEach(async () => {
    await db.deleteFrom("groups__sirets").execute();
    await db.deleteFrom("groups").execute();
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("establishments_location_infos").execute();
    await db.deleteFrom("establishments_location_positions").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("discussions").execute();
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("users").execute();

    await new PgUserRepository(db).save(user);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates an EstablishmentGroup and the links with sirets", async () => {
    await pgEstablishmentGroupRepository.save(laMieCalineGroup);
    await pgEstablishmentGroupRepository.save(carrefourGroupEntity);

    expectObjectInArrayToMatch(await getAllGroups(), [
      { name: "L'amie caline", slug: "l-amie-caline" },
      { name: "Carrefour", slug: "carrefour" },
    ]);
    expectObjectsToMatch(await getAllGroupsSirets(), [
      { group_slug: "carrefour", siret: "11112222111122" },
      { group_slug: "carrefour", siret: "33334444333344" },
    ]);
  });

  it("updates the group when one with the same slug already exists", async () => {
    await pgEstablishmentGroupRepository.save(carrefourGroupEntity);
    const updatedGroup: GroupEntity = {
      slug: carrefourGroupEntity.slug,
      name: carrefourGroupEntity.name,
      sirets: ["55556666555566", "77778888777788"],
      options: groupOptions,
    };

    await pgEstablishmentGroupRepository.save(updatedGroup);

    expectObjectInArrayToMatch(await getAllGroups(), [
      { name: "Carrefour", slug: "carrefour" },
    ]);
    expectObjectsToMatch(await getAllGroupsSirets(), [
      { group_slug: "carrefour", siret: updatedGroup.sirets[0] },
      { group_slug: "carrefour", siret: updatedGroup.sirets[1] },
    ]);
  });

  it("finds group information by slug", async () => {
    await pgEstablishmentGroupRepository.save(carrefourGroupEntity);

    const groupInfo = await pgEstablishmentGroupRepository.getGroupInfoBySlug(
      carrefourGroupEntity.slug,
    );

    expectToEqual(groupInfo, carrefourGroup);
  });

  describe("groupsWithSiret", () => {
    const group1WithSiret1: GroupEntity = {
      name: "group1",
      sirets: [siret1],
      slug: "group1",
      options: groupOptions,
    };

    const group2WithSiret1: GroupEntity = {
      name: "group2",
      sirets: [siret1],
      slug: "group2",
      options: groupOptions,
    };

    const group3WithAnotherSiret: GroupEntity = {
      name: "group3",
      sirets: ["another-siret"],
      slug: "group3",
      options: groupOptions,
    };

    it("Retreive groups with siret", async () => {
      await Promise.all(
        [group1WithSiret1, group2WithSiret1, group3WithAnotherSiret].map(
          (group) => pgEstablishmentGroupRepository.save(group),
        ),
      );

      expectToEqual(
        await pgEstablishmentGroupRepository.groupsWithSiret(siret1),
        [group1WithSiret1, group2WithSiret1],
      );
    });

    it("Retreive no groups when they don't have siret", async () => {
      await Promise.all(
        [group1WithSiret1, group2WithSiret1, group3WithAnotherSiret].map(
          (group) => pgEstablishmentGroupRepository.save(group),
        ),
      );

      expectToEqual(
        await pgEstablishmentGroupRepository.groupsWithSiret("unknown-siret"),
        [],
      );
    });
  });

  const getAllGroups = async () =>
    db.selectFrom("groups").selectAll().execute();

  const getAllGroupsSirets = async () =>
    db.selectFrom("groups__sirets").selectAll().execute();
});
