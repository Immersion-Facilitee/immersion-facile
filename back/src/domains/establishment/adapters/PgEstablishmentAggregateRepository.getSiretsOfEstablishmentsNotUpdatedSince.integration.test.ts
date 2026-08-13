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
import type {
  EstablishmentAggregate,
  EstablishmentUserRight,
} from "../entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../helpers/EstablishmentBuilders";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";

describe("PgScriptsQueries", () => {
  const user = new UserBuilder().withId(new UuidV4Generator().new()).build();
  const userRight: EstablishmentUserRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    job: "crêpier",
    phone: "+33600000000",
    userId: user.id,
    shouldReceiveDiscussionNotifications: true,
    isMainContactByPhone: false,
  };

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
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("establishments_location_infos").execute();
    await db.deleteFrom("establishments_location_positions").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("users").execute();

    await new PgUserRepository(db).save(user);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("getSiretsOfEstablishmentsNotUpdatedSince", () => {
    const updatedBefore = new Date("2023-07-01");

    const oldEstablishmentAggregate = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("11110000111100")
      .withEstablishmentUpdatedAt(subDays(updatedBefore, 10))
      .withLocationId("aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa")
      .withUserRights([userRight])
      .build();

    const middleEstablishmentAggregate = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("33330000333300")
      .withEstablishmentUpdatedAt(subDays(updatedBefore, 5))
      .withLocationId("aaaaaaaa-aaaa-4000-bbbb-bbbbbbbbbbbb")
      .withUserRights([userRight])
      .build();

    const recentlyUpdatedEstablishmentAggregate =
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("99990000999900")
        .withEstablishmentUpdatedAt(subDays(updatedBefore, -1))
        .withLocationId("aaaaaaaa-aaaa-4000-dddd-dddddddddddd")
        .withUserRights([userRight])
        .build();

    it("gets only the establishments updated before the given date, ordered from oldest to most recently updated", async () => {
      await Promise.all(
        [
          oldEstablishmentAggregate,
          middleEstablishmentAggregate,
          recentlyUpdatedEstablishmentAggregate,
        ].map((aggregate) =>
          pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            aggregate,
          ),
        ),
      );

      const sirets =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 10, offset: 0 },
        );

      expectToEqual(sirets, [
        oldEstablishmentAggregate.establishment.siret,
        middleEstablishmentAggregate.establishment.siret,
      ]);
    });

    it("paginates results with limit and offset", async () => {
      const recentlyOldEstablishmentAggregate: EstablishmentAggregate = {
        ...recentlyUpdatedEstablishmentAggregate,
        establishment: {
          ...recentlyUpdatedEstablishmentAggregate.establishment,
          siret: "22220000222200",
          updatedAt: subDays(updatedBefore, 1),
        },
      };

      await Promise.all(
        [
          oldEstablishmentAggregate,
          middleEstablishmentAggregate,
          recentlyOldEstablishmentAggregate,
        ].map((aggregate) =>
          pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            aggregate,
          ),
        ),
      );

      const firstPage =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 2, offset: 0 },
        );

      const secondPage =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 2, offset: 2 },
        );

      expectToEqual(firstPage, [
        oldEstablishmentAggregate.establishment.siret,
        middleEstablishmentAggregate.establishment.siret,
      ]);
      expectToEqual(secondPage, [
        recentlyOldEstablishmentAggregate.establishment.siret,
      ]);
    });

    it("paginates deterministically when several establishments share the same update_date", async () => {
      const sameUpdateDate =
        middleEstablishmentAggregate.establishment.updatedAt;

      const firstTiedEstablishmentAggregate: EstablishmentAggregate = {
        ...oldEstablishmentAggregate,
        establishment: {
          ...oldEstablishmentAggregate.establishment,
          updatedAt: sameUpdateDate,
        },
      };

      const thirdTiedEstablishmentAggregate: EstablishmentAggregate = {
        ...recentlyUpdatedEstablishmentAggregate,
        establishment: {
          ...recentlyUpdatedEstablishmentAggregate.establishment,
          updatedAt: sameUpdateDate,
        },
      };

      await Promise.all(
        [
          firstTiedEstablishmentAggregate,
          middleEstablishmentAggregate,
          thirdTiedEstablishmentAggregate,
        ].map((aggregate) =>
          pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            aggregate,
          ),
        ),
      );

      const firstPage =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 2, offset: 0 },
        );
      const secondPage =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 2, offset: 2 },
        );

      expectToEqual(firstPage, [
        oldEstablishmentAggregate.establishment.siret,
        middleEstablishmentAggregate.establishment.siret,
      ]);
      expectToEqual(secondPage, [
        recentlyUpdatedEstablishmentAggregate.establishment.siret,
      ]);
    });

    it("defaults offset to 0 when it is not provided", async () => {
      await Promise.all(
        [
          oldEstablishmentAggregate,
          middleEstablishmentAggregate,
          recentlyUpdatedEstablishmentAggregate,
        ].map((aggregate) =>
          pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            aggregate,
          ),
        ),
      );

      const sirets =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 1 },
        );

      expectToEqual(sirets, [oldEstablishmentAggregate.establishment.siret]);
    });

    it("excludes establishments updated exactly at the given date", async () => {
      const establishmentUpdatedAtBoundary: EstablishmentAggregate = {
        ...oldEstablishmentAggregate,
        establishment: {
          ...oldEstablishmentAggregate.establishment,
          siret: "44440000444400",
          updatedAt: updatedBefore,
        },
      };

      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentUpdatedAtBoundary,
      );

      const sirets =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 10, offset: 0 },
        );

      expectToEqual(sirets, []);
    });

    it("returns an empty array when no establishment matches", async () => {
      const sirets =
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
          { updatedBefore, limit: 10, offset: 0 },
        );

      expectToEqual(sirets, []);
    });
  });
});
