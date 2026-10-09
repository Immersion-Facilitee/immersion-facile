import type { Pool } from "pg";
import {
  type AppellationDto,
  expectObjectInArrayToMatch,
  expectObjectsToMatch,
  expectToEqual,
  type Group,
  type GroupOptions,
  type InternalOfferDto,
  type Location,
  type RemoteWorkMode,
  UserBuilder,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import type { EstablishmentUserRight } from "../entities/EstablishmentAggregate";
import type { EstablishmentEntity } from "../entities/EstablishmentEntity";
import type { GroupEntity } from "../entities/GroupEntity";
import {
  defaultLocation,
  EstablishmentAggregateBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";
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

  const carrefourGroup: Group = {
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
  const userRight: EstablishmentUserRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    userId: user.id,
    job: "",
    phone: "+33600000000",
    shouldReceiveDiscussionNotifications: true,
    isMainContactByPhone: false,
  };

  let pool: Pool;
  let db: KyselyDb;
  let pgEstablishmentGroupRepository: PgGroupRepository;
  let pgEstablishmentAggregateRepository: PgEstablishmentAggregateRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    pgEstablishmentGroupRepository = new PgGroupRepository(db);
    pgEstablishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      db,
    );
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

  it("finds search immersion results by slug", async () => {
    const offerBoulanger = new OfferEntityBuilder()
      .withRomeCode("D1102")
      .withAppellationCode("11574")
      .build();

    const offerAideBoulanger = new OfferEntityBuilder()
      .withRomeCode("D1102")
      .withAppellationCode("10868")
      .build();

    const offerBoucher = new OfferEntityBuilder()
      .withRomeCode("D1101")
      .withAppellationCode("11564")
      .build();

    const offerVendeurEnAlimentationGenerale = new OfferEntityBuilder()
      .withRomeCode("D1106")
      .withAppellationCode("20540")
      .build();

    const establishmentAggregate1 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret(carrefourGroupEntity.sirets[0])
      .withScore(15)
      .withLocationId("aaaaaaaa-aaaa-4444-bbbb-bbbbbbbbbbbb")
      .withOffers([offerBoulanger, offerAideBoulanger, offerBoucher])
      .withUserRights([userRight])
      .build();

    const establishmentAggregate2 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret(carrefourGroupEntity.sirets[1])
      .withLocations([
        defaultLocation,
        {
          id: "bbbbbbbb-bbbb-4444-bbbb-bbbbbbbbbbbb",
          position: {
            lat: 48.8566,
            lon: 2.3522,
          },
          address: {
            streetNumberAndAddress: "1 rue de la paix",
            postcode: "75002",
            city: "Paris",
            departmentCode: "75",
          },
        },
      ])
      .withOffers([offerVendeurEnAlimentationGenerale])
      .withUserRights([userRight])
      .build();

    await pgEstablishmentGroupRepository.save(carrefourGroupEntity);
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      establishmentAggregate1,
    );
    await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
      establishmentAggregate2,
    );

    const { establishment: establishment1 } = establishmentAggregate1;
    const { establishment: establishment2 } = establishmentAggregate2;

    const groupWithResults =
      await pgEstablishmentGroupRepository.getGroupWithSearchResultsBySlug(
        carrefourGroupEntity.slug,
      );

    const createSearchResult = ({
      establishment,
      rome,
      romeLabel,
      appellations,
      location,
      remoteWorkMode,
    }: {
      establishment: EstablishmentEntity;
      appellations: AppellationDto[];
      rome: string;
      romeLabel: string;
      location: Location;
      remoteWorkMode: RemoteWorkMode;
    }): InternalOfferDto => ({
      appellations,
      romeLabel,
      rome,
      additionalInformation: establishment.additionalInformation,
      address: location.address,
      contactMode: "EMAIL",
      customizedName: establishment.customizedName,
      distance_m: 0,
      fitForDisabledWorkers: establishment.fitForDisabledWorkers,
      naf: establishment.nafDto.code,
      nafLabel: "Activités des agences de travail temporaire", // matches default naf code : 7820Z
      name: establishment.name,
      numberOfEmployeeRange: establishment.numberEmployeesRange,
      position: location.position,
      siret: establishment.siret,
      establishmentScore: establishment.score,
      voluntaryToImmersion: establishment.voluntaryToImmersion,
      website: establishment.website,
      locationId: location.id,
      updatedAt: establishment.updatedAt?.toISOString(),
      createdAt: establishment.createdAt.toISOString(),
      remoteWorkMode,
      isAvailable: !establishment.isMaxDiscussionsForPeriodReached,
    });

    expectToEqual(groupWithResults, {
      group: carrefourGroup,
      results: [
        createSearchResult({
          establishment: establishment1,
          rome: "D1101",
          romeLabel: "Boucherie",
          appellations: [
            {
              appellationLabel: "Boucher / Bouchère",
              appellationCode: "11564",
            },
          ],
          location: establishment1.locations[0],
          remoteWorkMode: "ON_SITE",
        }),
        createSearchResult({
          establishment: establishment1,
          rome: "D1102",
          romeLabel: "Boulangerie - viennoiserie",
          appellations: [
            {
              appellationLabel: "Aide-boulanger / Aide-boulangère",
              appellationCode: "10868",
            },
            {
              appellationLabel: "Boulanger-pâtissier / Boulangère-pâtissière",
              appellationCode: "11574",
            },
          ],
          location: establishment1.locations[0],
          remoteWorkMode: "ON_SITE",
        }),
        createSearchResult({
          establishment: establishment2,
          rome: "D1106",
          romeLabel: "Vente en alimentation",
          appellations: [
            {
              appellationLabel: "Vendeur / Vendeuse en alimentation générale",
              appellationCode: "20540",
            },
          ],
          location: establishment2.locations[0],
          remoteWorkMode: "ON_SITE",
        }),
        createSearchResult({
          establishment: establishment2,
          rome: "D1106",
          romeLabel: "Vente en alimentation",
          appellations: [
            {
              appellationLabel: "Vendeur / Vendeuse en alimentation générale",
              appellationCode: "20540",
            },
          ],
          location: establishment2.locations[1],
          remoteWorkMode: "ON_SITE",
        }),
      ],
    });
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
