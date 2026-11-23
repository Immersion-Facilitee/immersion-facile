import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  DiscussionBuilder,
  defaultPerPageInWebPagination,
  expectToEqual,
  type Location,
  UserBuilder,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { PgAgencyRepository } from "../../agency/adapters/PgAgencyRepository";
import { PgConventionRepository } from "../../convention/adapters/PgConventionRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { EstablishmentAggregateBuilder } from "../helpers/EstablishmentBuilders";
import { PgDiscussionRepository } from "./PgDiscussionRepository";
import { PgEstablishmentAggregateQueries } from "./PgEstablishmentAggregateQueries";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";
import {
  artisteCirqueOffer,
  establishmentWithOfferA1101_AtPositionWithTwoLocations,
  osefUser,
  osefUserRight,
} from "./PgEstablishmentAggregateRepository.test.helpers";

describe("PgEstablishmentAggregateQueries", () => {
  let pool: Pool;
  let kyselyDb: KyselyDb;
  let pgEstablishmentAggregateRepository: PgEstablishmentAggregateRepository;
  let pgEstablishmentAggregateQueries: PgEstablishmentAggregateQueries;
  let pgUserRepository: PgUserRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    kyselyDb = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await kyselyDb.deleteFrom("convention_templates").execute();
    await kyselyDb.deleteFrom("conventions").execute();
    await kyselyDb.deleteFrom("agency_groups__agencies").execute();
    await kyselyDb.deleteFrom("agency_groups").execute();
    await kyselyDb.deleteFrom("agencies").execute();
    await kyselyDb.deleteFrom("establishments__users").execute();
    await kyselyDb.deleteFrom("immersion_offers").execute();
    await kyselyDb.deleteFrom("discussions").execute();
    await kyselyDb.deleteFrom("establishments_location_infos").execute();
    await kyselyDb.deleteFrom("establishments_location_positions").execute();
    await kyselyDb.deleteFrom("establishments").execute();
    await kyselyDb.deleteFrom("users").execute();
    await kyselyDb.deleteFrom("banned_establishments").execute();

    pgEstablishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      kyselyDb,
    );
    pgEstablishmentAggregateQueries = new PgEstablishmentAggregateQueries(
      kyselyDb,
    );
    pgUserRepository = new PgUserRepository(kyselyDb);

    await pgUserRepository.save(osefUser);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("getSearchResultBySearchQuery", () => {
    beforeEach(async () => {
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithOfferA1101_AtPositionWithTwoLocations,
      );
    });

    it("undefined when missing offer by siret", async () => {
      const missingSiret = "11111111111111";

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          missingSiret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        undefined,
      );
    });

    it("ignores location id when location does not exist anymore", async () => {
      const deletedLocationId =
        establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
          .locations[0].id;

      await kyselyDb
        .deleteFrom("establishments_location_infos")
        .where("id", "=", deletedLocationId)
        .execute();

      const searchResultWithoutLocationId =
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
        );

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          deletedLocationId,
        ),
        searchResultWithoutLocationId,
      );
    });

    it("undefined when missing offer appellation code", async () => {
      const missingAppellationCode = artisteCirqueOffer.appellationCode;

      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          missingAppellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        undefined,
      );
    });

    it("Returns reconstructed SearchImmersionResultDto for given siret, appellationCode and given location id", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .locations[0].id,
        ),
        {
          rome: establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .romeCode,
          romeLabel:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .romeLabel,
          establishmentScore:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .score,
          appellations: [
            {
              appellationLabel:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationLabel,
              appellationCode:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationCode,
            },
          ],
          naf: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.nafDto.code,
          nafLabel: "Activités des agences de travail temporaire",
          siret:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .siret,
          name: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.name,
          customizedName:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .customizedName,
          website:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .website,
          additionalInformation:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .additionalInformation,
          voluntaryToImmersion:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .voluntaryToImmersion,
          fitForDisabledWorkers:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .fitForDisabledWorkers,
          numberOfEmployeeRange:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .numberEmployeesRange,
          contactMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .contactMode,
          distance_m: undefined,
          address:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].address,
          position:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].position,
          locationId:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[0].id,
          createdAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.createdAt.toISOString(),
          updatedAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.updatedAt.toISOString(),
          remoteWorkMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .remoteWorkMode,
          isAvailable: true,
        },
      );
    });
    it("Returns first reconstructed SearchImmersionResultDto for given siret, appellationCode but no location id", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getSearchResultBySearchQuery(
          establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
            .siret,
          establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .appellationCode,
        ),
        {
          rome: establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
            .romeCode,
          romeLabel:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .romeLabel,
          establishmentScore:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .score,
          appellations: [
            {
              appellationLabel:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationLabel,
              appellationCode:
                establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
                  .appellationCode,
            },
          ],
          naf: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.nafDto.code,
          nafLabel: "Activités des agences de travail temporaire",
          siret:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .siret,
          name: establishmentWithOfferA1101_AtPositionWithTwoLocations
            .establishment.name,
          customizedName:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .customizedName,
          website:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .website,
          additionalInformation:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .additionalInformation,
          voluntaryToImmersion:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .voluntaryToImmersion,
          fitForDisabledWorkers:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .fitForDisabledWorkers,
          numberOfEmployeeRange:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .numberEmployeesRange,
          contactMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .contactMode,
          distance_m: undefined,
          address:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].address, // is the last location added
          position:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].position, // is the last location added
          locationId:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment
              .locations[1].id, // is the last location added
          createdAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.createdAt.toISOString(),
          updatedAt:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.establishment.updatedAt.toISOString(),
          remoteWorkMode:
            establishmentWithOfferA1101_AtPositionWithTwoLocations.offers[0]
              .remoteWorkMode,
          isAvailable: true,
        },
      );
    });
  });

  describe("getEstablishmentsForAdmin", () => {
    const contact = new UserBuilder()
      .withId("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
      .withEmail("jean.dupont@boulangerie.fr")
      .withFirstName("Jean")
      .withLastName("Dupont")
      .build();

    const makeLocation = (
      id: string,
      city: string,
      postcode: string,
    ): Location => ({
      id,
      address: {
        streetNumberAndAddress: "1 rue de la République",
        postcode,
        departmentCode: "69",
        city,
      },
      position: { lat: 45.764, lon: 4.8357 },
    });

    const bakery = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("11111111111111")
      .withEstablishmentName("BOULANGERIE DU CENTRE")
      .withEstablishmentCustomizedName("Le Fournil")
      .withLocations([
        makeLocation(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "Villeurbanne",
          "69100",
        ),
        makeLocation("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Lyon", "69001"),
      ])
      .withEstablishmentCreatedAt(new Date("2024-01-10T10:00:00.000Z"))
      .withEstablishmentUpdatedAt(new Date("2026-10-20T10:00:00.000Z"))
      .withUserRights([
        osefUserRight,
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: contact.id,
          shouldReceiveDiscussionNotifications: true,
        },
      ])
      .build();

    const garage = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("22222222222222")
      .withEstablishmentName("GARAGE MARTIN")
      .withEstablishmentCustomizedName(undefined)
      .withLocations([
        makeLocation("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "Lyon", "69002"),
      ])
      .withEstablishmentCreatedAt(new Date("2025-03-01T10:00:00.000Z"))
      .withEstablishmentUpdatedAt(new Date("2025-06-15T10:00:00.000Z"))
      .withUserRights([osefUserRight])
      .build();

    beforeEach(async () => {
      const agency = new AgencyDtoBuilder()
        .withId("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
        .build();

      await pgUserRepository.save(contact);
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        bakery,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        garage,
      );
      await new PgAgencyRepository(kyselyDb).insert(
        toAgencyWithRights(agency, {
          [osefUser.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      );

      const discussionRepository = new PgDiscussionRepository(kyselyDb);
      await discussionRepository.insert(
        new DiscussionBuilder()
          .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")
          .withSiret(bakery.establishment.siret)
          .build(),
      );
      await discussionRepository.insert(
        new DiscussionBuilder()
          .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2")
          .withSiret(bakery.establishment.siret)
          .build(),
      );

      const conventionRepository = new PgConventionRepository(kyselyDb);
      await conventionRepository.save(
        new ConventionDtoBuilder()
          .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1")
          .withAgencyId(agency.id)
          .withSiret(bakery.establishment.siret)
          .withStatus("ACCEPTED_BY_VALIDATOR")
          .build(),
      );
      await conventionRepository.save(
        new ConventionDtoBuilder()
          .withId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2")
          .withAgencyId(agency.id)
          .withSiret(bakery.establishment.siret)
          .withStatus("READY_TO_SIGN")
          .withoutDateValidation()
          .build(),
      );
    });

    const bakeryListItem = {
      siret: "11111111111111",
      name: "BOULANGERIE DU CENTRE",
      customizedName: "Le Fournil",
      city: "Lyon",
      postcode: "69001",
      otherLocationsCount: 1,
      createdAt: "2024-01-10T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
      discussionsCount: 2,
      validatedConventionsCount: 1,
    };

    const garageListItem = {
      siret: "22222222222222",
      name: "GARAGE MARTIN",
      customizedName: null,
      city: "Lyon",
      postcode: "69002",
      otherLocationsCount: 0,
      createdAt: "2025-03-01T10:00:00.000Z",
      updatedAt: "2025-06-15T10:00:00.000Z",
      discussionsCount: 0,
      validatedConventionsCount: 0,
    };

    it("returns establishments most recently updated first, with their first location and counts", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getEstablishmentsForAdmin({
          pagination: { page: 1, perPage: defaultPerPageInWebPagination },
        }),
        {
          data: [bakeryListItem, garageListItem],
          pagination: {
            currentPage: 1,
            numberPerPage: defaultPerPageInWebPagination,
            totalPages: 1,
            totalRecords: 2,
          },
        },
      );
    });

    it("paginates establishments", async () => {
      expectToEqual(
        await pgEstablishmentAggregateQueries.getEstablishmentsForAdmin({
          pagination: { page: 2, perPage: 1 },
        }),
        {
          data: [garageListItem],
          pagination: {
            currentPage: 2,
            numberPerPage: 1,
            totalPages: 2,
            totalRecords: 2,
          },
        },
      );
    });

    it.each([
      ["complete siret", "22222222222222", [garageListItem]],
      ["partial name, case insensitive", "garage mar", [garageListItem]],
      ["partial customized name", "fournil", [bakeryListItem]],
      [
        "complete contact email",
        "Jean.Dupont@Boulangerie.fr",
        [bakeryListItem],
      ],
      ["contact first name then last name", "jean dupont", [bakeryListItem]],
      ["contact last name then first name", "dupont jean", [bakeryListItem]],
      ["partial contact email", "@boulangerie.fr", []],
      ["partial siret", "2222222", []],
    ])("searches establishments by %s", async (_, search, expectedData) => {
      const { data, pagination } =
        await pgEstablishmentAggregateQueries.getEstablishmentsForAdmin({
          search,
          pagination: { page: 1, perPage: defaultPerPageInWebPagination },
        });

      expectToEqual(data, expectedData);
      expectToEqual(pagination.totalRecords, expectedData.length);
    });
  });
});
