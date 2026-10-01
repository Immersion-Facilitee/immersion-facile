import subDays from "date-fns/subDays";
import type { Pool } from "pg";
import { expectToEqual, UserBuilder } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../helpers/EstablishmentBuilders";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";

describe("PgEstablishmentAggregateRepository - getSiretsOfEstablishmentsToSuggestReengagement", () => {
  const notUpdatedNorSuggestedSince = new Date("2023-07-01");
  const user = new UserBuilder().withId(new UuidV4Generator().new()).build();

  let pool: Pool;
  let db: KyselyDb;
  let pgEstablishmentAggregateRepository: PgEstablishmentAggregateRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    pgEstablishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      db,
    );
  });

  beforeEach(async () => {
    await db.deleteFrom("notifications_email_recipients").execute();
    await db.deleteFrom("notifications_email_attachments").execute();
    await db.deleteFrom("notifications_email").execute();
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("establishments_location_infos").execute();
    await db.deleteFrom("establishments_location_positions").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("users").execute();

    await new PgUserRepository(db).save(user);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns an empty array when no establishment matches", async () => {
    const sirets =
      await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        { notUpdatedNorSuggestedSince, limit: 10 },
      );

    expectToEqual(sirets, []);
  });

  it("gets establishments not updated since the given date, ordered by update date then siret, up to the limit", async () => {
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("33330000333300")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 5))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-cccccccccccc")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22220000222200")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 5))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-bbbbbbbbbbbb")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("44440000444400")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 10))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-dddddddddddd")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("55550000555500")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 1))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-eeeeeeeeeeee")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );

    const sirets =
      await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        { notUpdatedNorSuggestedSince, limit: 3 },
      );

    expectToEqual(sirets, [
      "44440000444400",
      "22220000222200",
      "33330000333300",
    ]);
  });

  it("excludes establishments updated at or after the given date", async () => {
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11110000111100")
        .withEstablishmentUpdatedAt(notUpdatedNorSuggestedSince)
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22220000222200")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, -1))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-bbbbbbbbbbbb")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );

    const sirets =
      await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        { notUpdatedNorSuggestedSince, limit: 10 },
      );

    expectToEqual(sirets, []);
  });

  it("excludes establishments without accepted admin", async () => {
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11110000111100")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 1))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "PENDING",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22220000222200")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 1))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-bbbbbbbbbbbb")
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
          },
        ])
        .build(),
    );

    const sirets =
      await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        { notUpdatedNorSuggestedSince, limit: 10 },
      );

    expectToEqual(sirets, []);
  });

  it("excludes only establishments suggested a reengagement after the given date", async () => {
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11110000111100")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 10))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22220000222200")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 9))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-bbbbbbbbbbbb")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("33330000333300")
        .withEstablishmentUpdatedAt(subDays(notUpdatedNorSuggestedSince, 8))
        .withLocationId("aaaaaaaa-aaaa-4000-aaaa-cccccccccccc")
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "crêpier",
            phone: "+33600000000",
            userId: user.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build(),
    );
    await db
      .insertInto("notifications_email")
      .values([
        {
          id: "11111111-1111-4111-8111-111111111111",
          email_kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          establishment_siret: "11110000111100",
          created_at: subDays(notUpdatedNorSuggestedSince, -1).toISOString(),
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          email_kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          establishment_siret: "22220000222200",
          created_at: subDays(notUpdatedNorSuggestedSince, 1).toISOString(),
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          email_kind: "TEST_EMAIL",
          establishment_siret: "33330000333300",
          created_at: subDays(notUpdatedNorSuggestedSince, -1).toISOString(),
        },
      ])
      .execute();

    const sirets =
      await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsToSuggestReengagement(
        { notUpdatedNorSuggestedSince, limit: 10 },
      );

    expectToEqual(sirets, ["22220000222200", "33330000333300"]);
  });
});
