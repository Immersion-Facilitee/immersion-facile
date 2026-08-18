import { addDays, addMilliseconds, subDays } from "date-fns";
import type { Pool } from "pg";
import {
  arrayFromNumber,
  DiscussionBuilder,
  errors,
  expectArraysToEqual,
  expectArraysToEqualIgnoringOrder,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type InternalOfferDto,
  LocationBuilder,
  type NafCode,
  type SearchSortedBy,
  UserBuilder,
  type WithAcquisition,
  type WithSort,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import {
  rueBitcheDto,
  rueGuillaumeTellDto,
  rueJacquardDto,
} from "../../core/address/adapters/InMemoryAddressGateway";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import { phoneNumbersExist } from "../../core/phone-number/adapters/pgPhoneHelper";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import type { GeoParams } from "../entities/SearchMadeEntity";
import {
  defaultNafCode,
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../helpers/EstablishmentBuilders";
import type { GetOffersParams } from "../ports/EstablishmentAggregateRepository";
import { PgDiscussionRepository } from "./PgDiscussionRepository";
import { PgEstablishmentAggregateRepository } from "./PgEstablishmentAggregateRepository";
import {
  analysteEnGeomatiqueImmersionOffer,
  artisteCirqueOffer,
  bassompierreSaintesLocation,
  cartographeImmersionOffer,
  cartographeSearchMade,
  centerOfSaintesGeoPosition,
  closedEstablishment,
  cuvisteOffer,
  establishment0145Z_A,
  establishment0145Z_B,
  establishment4741Z,
  establishment9900Z,
  establishmentCuvisteAtChaniersAndLaRochelle,
  establishmentCuvisteAtSaintesAndVeaux,
  establishmentWithFitForDisabledWorkersNo,
  establishmentWithFitForDisabledWorkersYesCertified,
  establishmentWithFitForDisabledWorkersYesDeclaredOnly,
  establishmentWithOfferA1101_AtPosition,
  establishmentWithOfferA1101_close,
  establishmentWithOfferA1101_outOfDistanceRange,
  groomChevauxOffer,
  locationOfCloseSearchPosition,
  locationOfSearchPosition,
  locationOutOfAnySearchedPosition,
  makeExpectedSearchResult,
  offer_A1101_11987,
  offer_A1101_12862,
  offer_A1101_17751,
  offer_A1101_20404,
  osefUser,
  osefUserRight,
  portHubleChaniersLocation,
  randomizeTestEstablishmentAggregates,
  searchableByAllEstablishment,
  searchableByJobSeekerEstablishment,
  searchableByStudentsEstablishment,
  searchMadeDistanceWithoutRome,
  sortSearchResultsByDistanceAndRomeAndSiretOnRandomResults,
  tourDeLaChaineLaRochelleLocation,
  unavailableEstablishment,
  veauxLocation,
} from "./PgEstablishmentAggregateRepository.test.helpers";

describe("PgEstablishmentAggregateRepository", () => {
  let pool: Pool;
  let kyselyDb: KyselyDb;
  let pgEstablishmentAggregateRepository: PgEstablishmentAggregateRepository;
  let pgDiscussionRepository: PgDiscussionRepository;
  let pgUserRepository: PgUserRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    kyselyDb = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    await kyselyDb.deleteFrom("convention_templates").execute();
    await kyselyDb.deleteFrom("establishments__users").execute();
    await kyselyDb.deleteFrom("immersion_offers").execute();
    await kyselyDb.deleteFrom("discussions").execute();
    await kyselyDb.deleteFrom("establishments_location_infos").execute();
    await kyselyDb.deleteFrom("establishments_location_positions").execute();
    await kyselyDb.deleteFrom("establishments").execute();
    await kyselyDb.deleteFrom("convention_templates").execute();
    await kyselyDb.deleteFrom("users").execute();
    await kyselyDb.deleteFrom("banned_establishments").execute();

    pgEstablishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      kyselyDb,
    );
    pgDiscussionRepository = new PgDiscussionRepository(kyselyDb);
    pgUserRepository = new PgUserRepository(kyselyDb);

    await pgUserRepository.save(osefUser);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Offers", () => {
    const defaultSort: WithSort<SearchSortedBy>["sort"] = {
      by: "date",
      direction: "desc",
    };
    describe("getOffers", () => {
      const defaultFilters: GetOffersParams["filters"] = {
        showOnlyAvailableOffers: false,
      };
      const baseTestEstablishmentAggregates: EstablishmentAggregate[] = [
        establishmentWithOfferA1101_AtPosition,
        establishmentWithOfferA1101_close,
        establishmentWithOfferA1101_outOfDistanceRange,
        searchableByAllEstablishment,
        searchableByStudentsEstablishment,
        searchableByJobSeekerEstablishment,
      ];
      beforeEach(async () => {
        await kyselyDb.deleteFrom("establishments__users").execute();
        await kyselyDb.deleteFrom("immersion_offers").execute();
        await kyselyDb.deleteFrom("establishments_location_infos").execute();
        await kyselyDb
          .deleteFrom("establishments_location_positions")
          .execute();
        await kyselyDb.deleteFrom("establishments").execute();
        await kyselyDb.deleteFrom("banned_establishments").execute();
      });

      describe("no filters provided", () => {
        it("returns an empty array when repo is empty", async () => {
          expectToEqual(
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 20 },
              sort: defaultSort,
              filters: defaultFilters,
            }),
            {
              pagination: {
                currentPage: 1,
                totalPages: 1,
                numberPerPage: 20,
                totalRecords: 0,
              },
              data: [],
            },
          );
        });
        it("returns all open establishment results when no filters are provided", async () => {
          await Promise.all(
            [...baseTestEstablishmentAggregates, closedEstablishment].map(
              (establishmentAggregate) =>
                pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                  establishmentAggregate,
                ),
            ),
          );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: defaultSort,
            filters: defaultFilters,
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 20,
            totalRecords: 6,
          });
          expectToEqual(
            result.data,
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              makeExpectedSearchResult({
                establishment: establishmentAggregate,
                withOffers: establishmentAggregate.offers,
                withLocationAndDistance:
                  establishmentAggregate.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          );
        });

        it("excludes excludedSirets from total count and from rows", async () => {
          await Promise.all(
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
          const excludedSiret =
            establishmentWithOfferA1101_AtPosition.establishment.siret;
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              excludedSirets: [excludedSiret],
            },
          });

          expectToEqual(result.pagination.totalRecords, 5);
          expect(
            result.data.every((offer) => offer.siret !== excludedSiret),
          ).toBe(true);
        });

        it("returns all results when no filters are provided (object with keys and values undefined)", async () => {
          await Promise.all(
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              searchableBy: undefined,
              nafCodes: undefined,
              locationIds: undefined,
              sirets: undefined,
              fitForDisabledWorkers: undefined,
              appellationCodes: undefined,
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 6,
            },
            data: baseTestEstablishmentAggregates.map(
              (establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
            ),
          });
        });
        it("also returns non available (according to establishment max contact requests) offers", async () => {
          const establishmentSetWithUnavailableOne = [
            ...baseTestEstablishmentAggregates,
            unavailableEstablishment,
          ];

          await Promise.all(
            establishmentSetWithUnavailableOne.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              searchableBy: undefined,
              nafCodes: undefined,
              locationIds: undefined,
              sirets: undefined,
              fitForDisabledWorkers: undefined,
              appellationCodes: undefined,
            },
          });

          expect(result.data[6].isAvailable).toBe(false);

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 7,
            },
            data: establishmentSetWithUnavailableOne.map(
              (establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
            ),
          });
        });
      });

      describe("filters.searchableBy", () => {
        beforeEach(async () => {
          await Promise.all(
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("returns only establishments searchable by students when searchableBy='students'", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              searchableBy: "students",
            },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 5,
          });
          expectArraysToEqual(
            result.data,
            [
              establishmentWithOfferA1101_AtPosition,
              establishmentWithOfferA1101_close,
              establishmentWithOfferA1101_outOfDistanceRange,
              searchableByAllEstablishment,
              searchableByStudentsEstablishment,
            ].map((establishment) =>
              makeExpectedSearchResult({
                establishment,
                withLocationAndDistance:
                  establishment.establishment.locations[0],
                withOffers: establishment.offers,
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          );
        });

        it("returns only establishments searchable by jobSeekers when searchableBy='jobSeekers'", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              searchableBy: "jobSeekers",
            },
          });
          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 5,
          });
          expectArraysToEqual(
            result.data,
            [
              establishmentWithOfferA1101_AtPosition,
              establishmentWithOfferA1101_close,
              establishmentWithOfferA1101_outOfDistanceRange,
              searchableByAllEstablishment,
              searchableByJobSeekerEstablishment,
            ].map((establishment) =>
              makeExpectedSearchResult({
                establishment,
                withLocationAndDistance:
                  establishment.establishment.locations[0],
                withOffers: establishment.offers,
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          );
        });
      });

      describe("filters.sirets", () => {
        beforeEach(async () => {
          await Promise.all(
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("doesn't filter by sirets when no sirets are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, sirets: [] },
          });
          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 6,
          });
          expectToEqual(
            result.data,
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              makeExpectedSearchResult({
                establishment: establishmentAggregate,
                withOffers: establishmentAggregate.offers,
                withLocationAndDistance:
                  establishmentAggregate.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          );
        });
        it("filters by sirets list", async () => {
          const siret = searchableByAllEstablishment.establishment.siret;
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, sirets: [siret] },
          });

          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: searchableByAllEstablishment,
              withOffers: searchableByAllEstablishment.offers,
              withLocationAndDistance:
                searchableByAllEstablishment.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
            }),
          ]);
          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          });
        });
      });
      describe("filters.locationIds", () => {
        beforeEach(async () => {
          await Promise.all(
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });

        it("doesn't filter by locationIds when no locationIds are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, locationIds: [] },
          });
          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 6,
          });
          expectToEqual(
            result.data,
            baseTestEstablishmentAggregates.map((establishmentAggregate) =>
              makeExpectedSearchResult({
                establishment: establishmentAggregate,
                withOffers: establishmentAggregate.offers,
                withLocationAndDistance:
                  establishmentAggregate.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          );
        });
        it("filters by locationIds (single value)", async () => {
          const locId =
            searchableByAllEstablishment.establishment.locations[0].id;
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, locationIds: [locId] },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          });
          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: searchableByAllEstablishment,
              withOffers: searchableByAllEstablishment.offers,
              withLocationAndDistance:
                searchableByAllEstablishment.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
            }),
          ]);
        });
        it("filters by locationIds (multiple values)", async () => {
          await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            establishmentCuvisteAtSaintesAndVeaux,
          );
          const locIds =
            establishmentCuvisteAtSaintesAndVeaux.establishment.locations.map(
              (loc) => loc.id,
            );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, locationIds: locIds },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 2,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[1],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("filters by locationIds and geoParams", async () => {
          await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            establishmentCuvisteAtSaintesAndVeaux,
          );
          const locIds =
            establishmentCuvisteAtSaintesAndVeaux.establishment.locations.map(
              (loc) => loc.id,
            );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              locationIds: locIds,
              geoParams: {
                lat: establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[0].position.lat,
                lon: establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[0].position.lon,
                distanceKm: 10,
              },
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 1,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance: {
                  ...establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[0],
                  distance: 0,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
      });

      describe("filters.departmentCodes", () => {
        const establishmentInDepartment75: EstablishmentAggregate = {
          ...searchableByAllEstablishment,
          establishment: {
            ...searchableByAllEstablishment.establishment,
            siret: "00000000000070",
            locations: [
              {
                ...searchableByAllEstablishment.establishment.locations[0],
                id: uuid(),
                address: {
                  ...searchableByAllEstablishment.establishment.locations[0]
                    .address,
                  departmentCode: "75",
                },
              },
            ],
          },
        };
        const establishmentInDepartment76: EstablishmentAggregate = {
          ...searchableByStudentsEstablishment,
          establishment: {
            ...searchableByStudentsEstablishment.establishment,
            siret: "00000000000071",
            locations: [
              {
                ...searchableByStudentsEstablishment.establishment.locations[0],
                id: uuid(),
                address: {
                  ...searchableByStudentsEstablishment.establishment
                    .locations[0].address,
                  departmentCode: "76",
                },
              },
            ],
          },
        };
        const establishmentInDepartment95: EstablishmentAggregate = {
          ...searchableByJobSeekerEstablishment,
          establishment: {
            ...searchableByJobSeekerEstablishment.establishment,
            siret: "00000000000072",
            locations: [
              {
                ...searchableByJobSeekerEstablishment.establishment
                  .locations[0],
                id: uuid(),
                address: {
                  ...searchableByJobSeekerEstablishment.establishment
                    .locations[0].address,
                  departmentCode: "95",
                },
              },
            ],
          },
        };
        const departmentCodeTestEstablishmentAggregates: EstablishmentAggregate[] =
          [
            establishmentInDepartment75,
            establishmentInDepartment76,
            establishmentInDepartment95,
          ];

        beforeEach(async () => {
          await Promise.all(
            departmentCodeTestEstablishmentAggregates.map(
              (establishmentAggregate) =>
                pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                  establishmentAggregate,
                ),
            ),
          );
        });
        it("doesn't filter by departmentCodes when no departmentCodes are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, departmentCodes: [] },
          });
          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 3,
          });
          expectToEqual(
            result.data,
            departmentCodeTestEstablishmentAggregates.map(
              (establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
            ),
          );
        });
        it("filters by departmentCodes (single value)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, departmentCodes: ["75"] },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 1,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentInDepartment75,
                withOffers: establishmentInDepartment75.offers,
                withLocationAndDistance:
                  establishmentInDepartment75.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("filters by departmentCodes (multiple values)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, departmentCodes: ["75", "76"] },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 2,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentInDepartment75,
                withOffers: establishmentInDepartment75.offers,
                withLocationAndDistance:
                  establishmentInDepartment75.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentInDepartment76,
                withOffers: establishmentInDepartment76.offers,
                withLocationAndDistance:
                  establishmentInDepartment76.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("returns no result when departmentCodes has no match", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, departmentCodes: ["99"] },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 0,
            },
            data: [],
          });
        });
      });
      describe("filters.fitForDisabledWorkers", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          establishmentWithFitForDisabledWorkersYesCertified,
          establishmentWithFitForDisabledWorkersYesDeclaredOnly,
          establishmentWithFitForDisabledWorkersNo,
        ];

        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("filter on fitForDisabledWorkers with value 'yes-ft-certified'", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              fitForDisabledWorkers: ["yes-ft-certified"],
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 1,
            },
            data: [
              makeExpectedSearchResult({
                establishment:
                  establishmentWithFitForDisabledWorkersYesCertified,
                withOffers:
                  establishmentWithFitForDisabledWorkersYesCertified.offers,
                withLocationAndDistance:
                  establishmentWithFitForDisabledWorkersYesCertified
                    .establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("filter on fitForDisabledWorkers with value 'yes-declared-only'", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              fitForDisabledWorkers: ["yes-declared-only"],
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 1,
            },
            data: [
              makeExpectedSearchResult({
                establishment:
                  establishmentWithFitForDisabledWorkersYesDeclaredOnly,
                withOffers:
                  establishmentWithFitForDisabledWorkersYesDeclaredOnly.offers,
                withLocationAndDistance:
                  establishmentWithFitForDisabledWorkersYesDeclaredOnly
                    .establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("filter on fitForDisabledWorkers with value 'no'", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, fitForDisabledWorkers: ["no"] },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 1,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentWithFitForDisabledWorkersNo,
                withOffers: establishmentWithFitForDisabledWorkersNo.offers,
                withLocationAndDistance:
                  establishmentWithFitForDisabledWorkersNo.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
      });

      describe("filters.appellationCodes", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          ...baseTestEstablishmentAggregates,
          establishmentCuvisteAtSaintesAndVeaux,
          establishmentCuvisteAtChaniersAndLaRochelle,
        ];
        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });

        it("doesn't filter by appellationCodes when no appellationCodes are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, appellationCodes: [] },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 10,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentWithOfferA1101_AtPosition,
                withOffers: establishmentWithOfferA1101_AtPosition.offers,
                withLocationAndDistance:
                  establishmentWithOfferA1101_AtPosition.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentWithOfferA1101_close,
                withOffers: establishmentWithOfferA1101_close.offers,
                withLocationAndDistance:
                  establishmentWithOfferA1101_close.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentWithOfferA1101_outOfDistanceRange,
                withOffers:
                  establishmentWithOfferA1101_outOfDistanceRange.offers,
                withLocationAndDistance:
                  establishmentWithOfferA1101_outOfDistanceRange.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: searchableByAllEstablishment,
                withOffers: searchableByAllEstablishment.offers,
                withLocationAndDistance:
                  searchableByAllEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: searchableByStudentsEstablishment,
                withOffers: searchableByStudentsEstablishment.offers,
                withLocationAndDistance:
                  searchableByStudentsEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: searchableByJobSeekerEstablishment,
                withOffers: searchableByJobSeekerEstablishment.offers,
                withLocationAndDistance:
                  searchableByJobSeekerEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[1],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[1],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
        it("filters by appellationCodes (single value)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              appellationCodes: [cuvisteOffer.appellationCode],
            },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 4, // 2 establishments carry the cuviste offer; with 2 locations each
          });
          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: establishmentCuvisteAtSaintesAndVeaux,
              withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
              withLocationAndDistance:
                establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[1],
              nafLabel: "Activités des agences de travail temporaire",
            }),
            makeExpectedSearchResult({
              establishment: establishmentCuvisteAtSaintesAndVeaux,
              withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
              withLocationAndDistance:
                establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[0],
              nafLabel: "Activités des agences de travail temporaire",
            }),
            makeExpectedSearchResult({
              establishment: establishmentCuvisteAtChaniersAndLaRochelle,
              withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
              withLocationAndDistance:
                establishmentCuvisteAtChaniersAndLaRochelle.establishment
                  .locations[0],
              nafLabel: "Activités des agences de travail temporaire",
            }),
            makeExpectedSearchResult({
              establishment: establishmentCuvisteAtChaniersAndLaRochelle,
              withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
              withLocationAndDistance:
                establishmentCuvisteAtChaniersAndLaRochelle.establishment
                  .locations[1],
              nafLabel: "Activités des agences de travail temporaire",
            }),
          ]);
        });
        it("filters by appellationCodes (multiple values)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              appellationCodes: [
                cuvisteOffer.appellationCode,
                cartographeImmersionOffer.appellationCode,
              ],
            },
          });
          const expectedSirets = [
            searchableByAllEstablishment.establishment.siret,
            searchableByStudentsEstablishment.establishment.siret,
            searchableByJobSeekerEstablishment.establishment.siret,
            establishmentCuvisteAtSaintesAndVeaux.establishment.siret,
            establishmentCuvisteAtSaintesAndVeaux.establishment.siret,
            establishmentCuvisteAtChaniersAndLaRochelle.establishment.siret,
            establishmentCuvisteAtChaniersAndLaRochelle.establishment.siret,
          ];
          expectArraysToEqual(
            result.data.map((result) => result.siret),
            expectedSirets,
          );
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 7,
            },
            data: [
              makeExpectedSearchResult({
                establishment: searchableByAllEstablishment,
                withOffers: searchableByAllEstablishment.offers,
                withLocationAndDistance:
                  searchableByAllEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: searchableByStudentsEstablishment,
                withOffers: searchableByStudentsEstablishment.offers,
                withLocationAndDistance:
                  searchableByStudentsEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: searchableByJobSeekerEstablishment,
                withOffers: searchableByJobSeekerEstablishment.offers,
                withLocationAndDistance:
                  searchableByJobSeekerEstablishment.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[1],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),

              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance:
                  establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[1],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
      });

      describe("filters.nafCodes", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          ...baseTestEstablishmentAggregates,
          establishment0145Z_A,
          establishment0145Z_B,
          establishment4741Z,
        ];
        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });

        it("doesn't filter by nafCodes when no nafCodes are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, nafCodes: [] },
          });
          const nafLabelByNafCode: Record<NafCode, string> = {
            "0145Z": "Élevage d'ovins et de caprins",
            "4741Z":
              "Commerce de détail d'ordinateurs, d'unités périphériques et de logiciels en magasin spécialisé",
          };

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 9,
            },
            data: testEstablishmentAggregates.map((establishmentAggregate) =>
              makeExpectedSearchResult({
                establishment: establishmentAggregate,
                withOffers: establishmentAggregate.offers,
                withLocationAndDistance:
                  establishmentAggregate.establishment.locations[0],
                nafLabel:
                  nafLabelByNafCode[
                    establishmentAggregate.establishment.nafDto.code
                  ] ?? "Activités des agences de travail temporaire",
              }),
            ),
          });
        });
        it("filters by nafCodes (single value)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, nafCodes: ["0145Z"] },
          });

          const expectedEstablishments = [
            establishment0145Z_A,
            establishment0145Z_B,
          ];

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 2,
            },
            data: expectedEstablishments.map((establishment) =>
              makeExpectedSearchResult({
                establishment,
                withOffers: establishment.offers,
                withLocationAndDistance:
                  establishment.establishment.locations[0],
                nafLabel: "Élevage d'ovins et de caprins",
              }),
            ),
          });
        });
        it("filters by nafCodes (multiple values)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, nafCodes: ["0145Z", "4741Z"] },
          });
          const expectedEstablishments = [
            establishment0145Z_A,
            establishment0145Z_B,
            establishment4741Z,
          ];
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 3,
            },
            data: expectedEstablishments.map((establishment) =>
              makeExpectedSearchResult({
                establishment,
                withOffers: establishment.offers,
                withLocationAndDistance:
                  establishment.establishment.locations[0],
                nafLabel:
                  establishment.establishment.nafDto.code === "0145Z"
                    ? "Élevage d'ovins et de caprins"
                    : "Commerce de détail d'ordinateurs, d'unités périphériques et de logiciels en magasin spécialisé",
              }),
            ),
          });
        });
      });

      describe("filters.remoteWorkModes", () => {
        const offerNoRemote = new OfferEntityBuilder()
          .withRomeCode("A1101")
          .withAppellationLabel("Chauffeur / Chauffeuse de machines agricoles")
          .withAppellationCode("11987")
          .withRomeLabel("Conduite d'engins agricoles et forestiers")
          .withRemoteWorkMode("ON_SITE")
          .build();

        const offerHybrid = new OfferEntityBuilder()
          .withRomeCode("I1307")
          .withRomeLabel(
            "Installation et maintenance télécoms et courants faibles",
          )
          .withAppellationLabel(
            "Technicien / Technicienne d'installation en domotique",
          )
          .withAppellationCode("19999")
          .withRemoteWorkMode("HYBRID")
          .build();

        const offerFullRemote = new OfferEntityBuilder()
          .withRomeCode("I1307")
          .withRomeLabel(
            "Installation et maintenance télécoms et courants faibles",
          )
          .withAppellationLabel(
            "Technicien / Technicienne d'installation en courants faibles",
          )
          .withAppellationCode("19998")
          .withRemoteWorkMode("FULL_REMOTE")
          .build();

        const establishmentWithNoRemoteOffer =
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("11111111111111")
            .withOffers([offerNoRemote])
            .withLocationId(uuid())
            .withUserRights([osefUserRight])
            .build();

        const establishmentWithHybridOffer = new EstablishmentAggregateBuilder()
          .withEstablishmentSiret("22222222222222")
          .withOffers([offerHybrid])
          .withLocationId(uuid())
          .withUserRights([osefUserRight])
          .build();

        const establishmentWithFullRemoteOffer =
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("33333333333333")
            .withOffers([offerFullRemote])
            .withLocationId(uuid())
            .withUserRights([osefUserRight])
            .build();

        const establishmentWithMixedRemoteOffers =
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("44444444444444")
            .withOffers([offerFullRemote, offerHybrid])
            .withLocationId(uuid())
            .withUserRights([osefUserRight])
            .build();

        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          establishmentWithNoRemoteOffer,
          establishmentWithHybridOffer,
          establishmentWithFullRemoteOffer,
          establishmentWithMixedRemoteOffers,
        ];

        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });

        it("doesn't filter by remoteWorkModes when no remoteWorkModes are provided (empty array)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, remoteWorkModes: [] },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 5, // 1 per establishment except establishmentWithMixedRemoteOffers which has 2 (grouped by siret + rome + location + remoteWorkMode)
          });
        });

        it("filters by remoteWorkModes (single value: ON_SITE)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, remoteWorkModes: ["ON_SITE"] },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 1,
          });

          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: establishmentWithNoRemoteOffer,
              withOffers: establishmentWithNoRemoteOffer.offers,
              withLocationAndDistance:
                establishmentWithNoRemoteOffer.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
            }),
          ]);
        });

        it("filters by remoteWorkModes (single value: HYBRID)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, remoteWorkModes: ["HYBRID"] },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2, // establishmentWithHybridOffer + establishmentWithMixedRemoteOffers
          });

          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: establishmentWithHybridOffer,
              withOffers: establishmentWithHybridOffer.offers,
              withLocationAndDistance:
                establishmentWithHybridOffer.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "HYBRID",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithMixedRemoteOffers,
              withOffers: establishmentWithMixedRemoteOffers.offers,
              withLocationAndDistance:
                establishmentWithMixedRemoteOffers.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "HYBRID",
            }),
          ]);
        });

        it("filters by remoteWorkModes (single value: FULL_REMOTE)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: { ...defaultFilters, remoteWorkModes: ["FULL_REMOTE"] },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 2, // establishmentWithFullRemoteOffer + 1 of establishmentWithMixedRemoteOffers
          });

          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: establishmentWithFullRemoteOffer,
              withOffers: establishmentWithFullRemoteOffer.offers,
              withLocationAndDistance:
                establishmentWithFullRemoteOffer.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "FULL_REMOTE",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithMixedRemoteOffers,
              withOffers: establishmentWithMixedRemoteOffers.offers,
              withLocationAndDistance:
                establishmentWithMixedRemoteOffers.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "FULL_REMOTE",
            }),
          ]);
        });

        it("filters by remoteWorkModes (multiple values)", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: defaultSort,
            filters: {
              ...defaultFilters,
              remoteWorkModes: ["HYBRID", "FULL_REMOTE"],
            },
          });

          expectToEqual(result.pagination, {
            currentPage: 1,
            totalPages: 1,
            numberPerPage: 10,
            totalRecords: 4, // 1 from establishmentWithHybridOffer + 1 from establishmentWithFullRemoteOffer + 2 from establishmentWithMixedRemoteOffers (one for each remoteWorkMode)
          });

          expectToEqual(result.data, [
            makeExpectedSearchResult({
              establishment: establishmentWithHybridOffer,
              withOffers: establishmentWithHybridOffer.offers,
              withLocationAndDistance:
                establishmentWithHybridOffer.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "HYBRID",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithFullRemoteOffer,
              withOffers: establishmentWithFullRemoteOffer.offers,
              withLocationAndDistance:
                establishmentWithFullRemoteOffer.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "FULL_REMOTE",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithMixedRemoteOffers,
              withOffers: establishmentWithMixedRemoteOffers.offers,
              withLocationAndDistance:
                establishmentWithMixedRemoteOffers.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "FULL_REMOTE",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithMixedRemoteOffers,
              withOffers: establishmentWithMixedRemoteOffers.offers,
              withLocationAndDistance:
                establishmentWithMixedRemoteOffers.establishment.locations[0],
              nafLabel: "Activités des agences de travail temporaire",
              remoteWorkMode: "HYBRID",
            }),
          ]);
        });
      });

      describe("filters.geoParams", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          establishmentWithOfferA1101_AtPosition,
          establishmentWithOfferA1101_close,
          establishmentWithOfferA1101_outOfDistanceRange,
        ];
        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("should throw on a search made with sortedBy distance and no geo params are provided", async () => {
          // Assert
          await expectPromiseToFailWithError(
            pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: defaultFilters,
            }),
            errors.establishment.invalidGeoParams(),
          );
        });

        it("should throw if all geo params value is 0 and sorted by distance", async () => {
          // Assert
          await expectPromiseToFailWithError(
            pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: 0,
                  lon: 0,
                  distanceKm: 0,
                },
              },
            }),
            errors.establishment.invalidGeoParams(),
          );
        });

        it("should throw if lat / lon are 0 but distanceKm is provided and not 0 and sorted by distance", async () => {
          // Assert
          await expectPromiseToFailWithError(
            pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: 0,
                  lon: 0,
                  distanceKm: 10,
                },
              },
            }),
            errors.establishment.invalidGeoParams(),
          );
        });
        it("should throw if one of the geo params value is 0", async () => {
          // Assert
          await expectPromiseToFailWithError(
            pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: 0,
                  lon: 45,
                  distanceKm: 10,
                },
              },
            }),
            errors.establishment.invalidGeoParams(),
          );
        });
        it("filters by geoParams", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "distance", direction: "asc" },
            filters: {
              ...defaultFilters,
              geoParams: {
                lat: locationOfSearchPosition.position.lat,
                lon: locationOfSearchPosition.position.lon,
                distanceKm: 10,
              },
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 2,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentWithOfferA1101_AtPosition,
                withOffers: [offer_A1101_11987],
                withLocationAndDistance: {
                  ...locationOfSearchPosition,
                  distance: 0,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentWithOfferA1101_close,
                withOffers: [offer_A1101_11987],
                withLocationAndDistance: {
                  ...locationOfCloseSearchPosition,
                  distance: 133.12254555,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
      });

      describe("sorting and pagination", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] = [
          establishmentWithOfferA1101_close,
          establishmentWithOfferA1101_AtPosition,
          establishmentWithOfferA1101_outOfDistanceRange,
        ];
        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });

        it("sorts by distance and paginates results", async () => {
          const expectedResults = [
            makeExpectedSearchResult({
              establishment: establishmentWithOfferA1101_AtPosition,
              withOffers: [offer_A1101_11987],
              withLocationAndDistance: {
                ...locationOfSearchPosition,
                distance: 0,
              },
              nafLabel: "Activités des agences de travail temporaire",
            }),
            makeExpectedSearchResult({
              establishment: establishmentWithOfferA1101_close,
              withOffers: [offer_A1101_11987],
              withLocationAndDistance: {
                ...locationOfCloseSearchPosition,
                distance: 133.12254555,
              },
              nafLabel: "Activités des agences de travail temporaire",
            }),
          ];
          const allResults = await pgEstablishmentAggregateRepository.getOffers(
            {
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: locationOfSearchPosition.position.lat,
                  lon: locationOfSearchPosition.position.lon,
                  distanceKm: 20,
                },
              },
            },
          );
          expectToEqual(allResults, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 2,
            },
            data: expectedResults,
          });

          const resultPage1 =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 1 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: locationOfSearchPosition.position.lat,
                  lon: locationOfSearchPosition.position.lon,
                  distanceKm: 20,
                },
              },
            });

          expectToEqual(resultPage1, {
            pagination: {
              currentPage: 1,
              totalPages: 2,
              numberPerPage: 1,
              totalRecords: 2,
            },
            data: [expectedResults[0]],
          });

          const resultPage2 =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 2, perPage: 1 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams: {
                  lat: locationOfSearchPosition.position.lat,
                  lon: locationOfSearchPosition.position.lon,
                  distanceKm: 20,
                },
              },
            });

          expectToEqual(resultPage2, {
            pagination: {
              currentPage: 2,
              totalPages: 2,
              numberPerPage: 1,
              totalRecords: 2,
            },
            data: [expectedResults[1]],
          });
        });

        it("provides totalPages=1 when there are zero results", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 5 },
            sort: { by: "date", direction: "desc" },
            filters: { ...defaultFilters, sirets: ["NO_SUCH_SIRET"] },
          });

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 5,
              totalRecords: 0,
            },
            data: [],
          });
        });
      });

      describe("sorting.date", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] =
          baseTestEstablishmentAggregates
            .map((establishmentAggregate, index) => {
              return {
                ...establishmentAggregate,
                establishment: {
                  ...establishmentAggregate.establishment,
                  updatedAt: subDays(new Date(), index),
                },
              };
            })
            .sort(randomizeTestEstablishmentAggregates);

        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("sorts by date:asc", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "date", direction: "asc" },
            filters: defaultFilters,
          });
          const expectedSortedResults = [
            ...testEstablishmentAggregates.sort(
              (a, b) =>
                a.establishment.updatedAt.getTime() -
                b.establishment.updatedAt.getTime(),
            ),
          ];

          const expectedResultsSiretsAndDate = expectedSortedResults.map(
            (establishmentAggregate) => {
              return {
                siret: establishmentAggregate.establishment.siret,
                updatedAt:
                  establishmentAggregate.establishment.updatedAt.toISOString(),
              };
            },
          );

          expectArraysToEqual(
            result.data.map((result) => ({
              siret: result.siret,
              updatedAt: result.updatedAt,
            })),
            expectedResultsSiretsAndDate,
          );
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 6,
            },
            data: expectedSortedResults.map((establishmentAggregate) =>
              makeExpectedSearchResult({
                establishment: establishmentAggregate,
                withOffers: establishmentAggregate.offers,
                withLocationAndDistance:
                  establishmentAggregate.establishment.locations[0],
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ),
          });
        });
        it("sorts by date:desc", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "date", direction: "desc" },
            filters: defaultFilters,
          });

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 6,
            },
            data: testEstablishmentAggregates
              .sort(
                (a, b) =>
                  b.establishment.updatedAt.getTime() -
                  a.establishment.updatedAt.getTime(),
              )
              .map((establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
              ),
          });
        });
      });
      describe("sorting.score", () => {
        const testEstablishmentAggregates: EstablishmentAggregate[] =
          baseTestEstablishmentAggregates
            .map((establishmentAggregate, index) => {
              return {
                ...establishmentAggregate,
                establishment: {
                  ...establishmentAggregate.establishment,
                  score: index,
                },
              };
            })
            .sort(randomizeTestEstablishmentAggregates);

        beforeEach(async () => {
          await Promise.all(
            testEstablishmentAggregates.map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("sorts by score:asc", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "score", direction: "asc" },
            filters: defaultFilters,
          });

          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 6,
            },
            data: testEstablishmentAggregates
              .sort((a, b) => a.establishment.score - b.establishment.score)
              .map((establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
              ),
          });
        });
        it("sorts by score:desc", async () => {
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "score", direction: "desc" },
            filters: defaultFilters,
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 6,
            },
            data: testEstablishmentAggregates
              .sort((a, b) => b.establishment.score - a.establishment.score)
              .map((establishmentAggregate) =>
                makeExpectedSearchResult({
                  establishment: establishmentAggregate,
                  withOffers: establishmentAggregate.offers,
                  withLocationAndDistance:
                    establishmentAggregate.establishment.locations[0],
                  nafLabel: "Activités des agences de travail temporaire",
                }),
              ),
          });
        });
      });

      it("whatever sort param, filtering by appellationCodes returns same results in different order", async () => {
        const fillerCount = 5001;
        const targetAppellationCode = offer_A1101_11987.appellationCode;

        const targetEstablishments: EstablishmentAggregate[] = [
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("99000000000001")
            .withEstablishmentUpdatedAt(new Date("2025-06-01"))
            .withScore(1)
            .withLocations([
              new LocationBuilder(locationOfSearchPosition)
                .withId(uuid())
                .build(),
            ])
            .withOffers([offer_A1101_11987])
            .withUserRights([osefUserRight])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("99000000000002")
            .withEstablishmentUpdatedAt(new Date("2025-06-02"))
            .withScore(2)
            .withLocations([
              new LocationBuilder(locationOfCloseSearchPosition)
                .withId(uuid())
                .build(),
            ])
            .withOffers([offer_A1101_11987])
            .withUserRights([osefUserRight])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("99000000000003")
            .withEstablishmentUpdatedAt(new Date("2025-06-03"))
            .withScore(3)
            .withLocations([
              new LocationBuilder(locationOutOfAnySearchedPosition)
                .withId(uuid())
                .build(),
            ])
            .withOffers([offer_A1101_11987])
            .withUserRights([osefUserRight])
            .build(),
        ];

        await Promise.all(
          targetEstablishments.map((target) =>
            pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
              target,
            ),
          ),
        );

        const batchSize = 1000;
        const fillerSirets = arrayFromNumber(fillerCount).map(
          (i) => `F${(i + 1).toString().padStart(13, "0")}`,
        );

        await Promise.all(
          arrayFromNumber(Math.ceil(fillerSirets.length / batchSize)).map((i) =>
            kyselyDb
              .insertInto("establishments")
              .values(
                fillerSirets
                  .slice(i * batchSize, (i + 1) * batchSize)
                  .map((siret) => ({
                    siret,
                    name: "Filler",
                    source_provider: "immersion-facile",
                    naf_code: defaultNafCode,
                    naf_nomenclature: "NAFRev2",
                    number_employees: "10-19",
                    update_date: new Date("2010-01-01"),
                    created_at: new Date("2010-01-01"),
                    is_open: true,
                    contact_mode: "EMAIL" as const,
                    max_contacts_per_month: 10,
                    searchable_by_job_seekers: true,
                    searchable_by_students: true,
                    fit_for_disabled_workers: "no",
                    score: 50,
                    customized_name: null,
                    is_commited: null,
                    last_insee_check_date: null,
                    next_availability_date: null,
                    welcome_address_street_number_and_address: null,
                    welcome_address_postcode: null,
                    welcome_address_city: null,
                    welcome_address_department_code: null,
                    welcome_address_lat: null,
                    welcome_address_lon: null,
                  })),
              )
              .execute(),
          ),
        );

        const filters: GetOffersParams["filters"] = {
          appellationCodes: [targetAppellationCode],
          showOnlyAvailableOffers: false,
        };

        const expectedSiretsAsc = [
          "99000000000001",
          "99000000000002",
          "99000000000003",
        ];
        const expectedSiretsDesc = [...expectedSiretsAsc].reverse();
        const expectedPagination = {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 20,
          totalRecords: targetEstablishments.length,
        };

        const resultByDateDesc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "date", direction: "desc" },
            filters,
          });
        expectToEqual(resultByDateDesc.pagination, expectedPagination);
        expectToEqual(
          resultByDateDesc.data.map((d) => d.siret),
          expectedSiretsDesc,
        );

        const resultByDateAsc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "date", direction: "asc" },
            filters,
          });
        expectToEqual(resultByDateAsc.pagination, expectedPagination);
        expectToEqual(
          resultByDateAsc.data.map((d) => d.siret),
          expectedSiretsAsc,
        );

        const resultByScoreDesc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "score", direction: "desc" },
            filters,
          });
        expectToEqual(resultByScoreDesc.pagination, expectedPagination);
        expectToEqual(
          resultByScoreDesc.data.map((d) => d.siret),
          expectedSiretsDesc,
        );

        const resultByScoreAsc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "score", direction: "asc" },
            filters,
          });
        expectToEqual(resultByScoreAsc.pagination, expectedPagination);
        expectToEqual(
          resultByScoreAsc.data.map((d) => d.siret),
          expectedSiretsAsc,
        );

        const geoFilters: GetOffersParams["filters"] = {
          ...filters,
          geoParams: {
            lat: locationOfSearchPosition.position.lat,
            lon: locationOfSearchPosition.position.lon,
            distanceKm: 10_000,
          },
        };

        const resultByDistanceDesc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "distance", direction: "desc" },
            filters: geoFilters,
          });
        expectToEqual(resultByDistanceDesc.pagination, expectedPagination);
        expectToEqual(
          resultByDistanceDesc.data.map((d) => d.siret),
          expectedSiretsAsc, // Query by distance is fixed to ASC sorting (by design?)
        );

        const resultByDistanceAsc =
          await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 20 },
            sort: { by: "distance", direction: "asc" },
            filters: geoFilters,
          });
        expectToEqual(resultByDistanceAsc.pagination, expectedPagination);
        expectToEqual(
          resultByDistanceAsc.data.map((d) => d.siret),
          expectedSiretsAsc,
        );
      }, 30_000);

      describe("tricky tests", () => {
        beforeEach(async () => {
          await Promise.all(
            [
              establishmentWithOfferA1101_AtPosition,
              establishmentWithOfferA1101_close,
              searchableByAllEstablishment,
              searchableByStudentsEstablishment,
              searchableByJobSeekerEstablishment,
            ].map((establishmentAggregate) =>
              pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
                establishmentAggregate,
              ),
            ),
          );
        });
        it("should return same number of results regardless of the sortedBy parameter", async () => {
          const expectedTotalRecords = 5;
          const geoParams: GeoParams = {
            ...locationOfSearchPosition.position,
            distanceKm: 100,
          };
          const resultsByDateDesc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "date", direction: "desc" },
              filters: defaultFilters,
            });
          const resultsByDateAsc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "date", direction: "asc" },
              filters: defaultFilters,
            });
          const resultsByScoreDesc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "score", direction: "desc" },
              filters: defaultFilters,
            });
          const resultsByScoreAsc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "score", direction: "asc" },
              filters: defaultFilters,
            });
          const resultsByDistanceDesc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "desc" },
              filters: {
                ...defaultFilters,
                geoParams,
              },
            });
          const resultsByDistanceAsc =
            await pgEstablishmentAggregateRepository.getOffers({
              pagination: { page: 1, perPage: 10 },
              sort: { by: "distance", direction: "asc" },
              filters: {
                ...defaultFilters,
                geoParams,
              },
            });
          expectToEqual(
            {
              resultsByDateDesc: resultsByDateDesc.pagination.totalRecords,
              resultsByDateAsc: resultsByDateAsc.pagination.totalRecords,
              resultsByScoreDesc: resultsByScoreDesc.pagination.totalRecords,
              resultsByScoreAsc: resultsByScoreAsc.pagination.totalRecords,
              resultsByDistanceDesc:
                resultsByDistanceDesc.pagination.totalRecords,
              resultsByDistanceAsc:
                resultsByDistanceAsc.pagination.totalRecords,
            },
            {
              resultsByDateDesc: expectedTotalRecords,
              resultsByDateAsc: expectedTotalRecords,
              resultsByScoreDesc: expectedTotalRecords,
              resultsByScoreAsc: expectedTotalRecords,
              resultsByDistanceDesc: expectedTotalRecords,
              resultsByDistanceAsc: expectedTotalRecords,
            },
          );
        });

        it("combo : filter by appellationCodes and localization", async () => {
          await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            establishmentCuvisteAtSaintesAndVeaux,
          );

          await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            establishmentCuvisteAtChaniersAndLaRochelle,
          );
          const result = await pgEstablishmentAggregateRepository.getOffers({
            pagination: { page: 1, perPage: 10 },
            sort: { by: "distance", direction: "asc" },
            filters: {
              ...defaultFilters,
              appellationCodes: [
                cuvisteOffer.appellationCode,
                artisteCirqueOffer.appellationCode,
              ],
              geoParams: {
                lat: establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[0].position.lat,
                lon: establishmentCuvisteAtSaintesAndVeaux.establishment
                  .locations[0].position.lon,
                distanceKm: 100,
              },
            },
          });
          expectToEqual(result, {
            pagination: {
              currentPage: 1,
              totalPages: 1,
              numberPerPage: 10,
              totalRecords: 3,
            },
            data: [
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtSaintesAndVeaux,
                withOffers: establishmentCuvisteAtSaintesAndVeaux.offers,
                withLocationAndDistance: {
                  ...establishmentCuvisteAtSaintesAndVeaux.establishment
                    .locations[0],
                  distance: 0,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance: {
                  ...establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[0],
                  distance: 3573.85964781,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
              makeExpectedSearchResult({
                establishment: establishmentCuvisteAtChaniersAndLaRochelle,
                withOffers: establishmentCuvisteAtChaniersAndLaRochelle.offers,
                withLocationAndDistance: {
                  ...establishmentCuvisteAtChaniersAndLaRochelle.establishment
                    .locations[1],
                  distance: 61349.82542741,
                },
                nafLabel: "Activités des agences de travail temporaire",
              }),
            ],
          });
        });
      });
    });

    describe("getOffersAsAppellationDtoForFormEstablishment", () => {
      beforeEach(async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentWithOfferA1101_AtPosition,
        );
      });

      it("returns an empty list if no establishment found with this siret", async () => {
        const siretNotInTable = "11111111111111";

        expectToEqual(
          await pgEstablishmentAggregateRepository.getOffersAsAppellationAndRomeDtosBySiret(
            siretNotInTable,
          ),
          [],
        );
      });

      it("returns a list with offers from offers as AppellationDto of given siret", async () => {
        expectArraysToEqualIgnoringOrder(
          await pgEstablishmentAggregateRepository.getOffersAsAppellationAndRomeDtosBySiret(
            establishmentWithOfferA1101_AtPosition.establishment.siret,
          ),
          establishmentWithOfferA1101_AtPosition.offers.map((offer) => ({
            appellationCode: offer.appellationCode,
            appellationLabel: offer.appellationLabel,
            romeCode: offer.romeCode,
            romeLabel: offer.romeLabel,
          })),
        );
      });
    });
  });

  describe("EstablishmentAggregates", () => {
    describe("insertEstablishmentAggregates", () => {
      const siret1 = "11111111111111";
      const siret2 = "22222222222222";

      it("no establishment", async () => {
        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [],
        );
      });

      it("adds the establishment values in `establishments` table when one new establishment is given", async () => {
        const establishmentAggregate = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder()
              .withMaxContactsPerMonth(24)
              .withLastInseeCheck(new Date("2020-04-14T12:00:00.000"))
              .build(),
          )
          .withUserRights([osefUserRight])
          .build();

        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentAggregate,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentAggregate],
        );
      });

      it("adds the establishment values in `establishments` table with welcome address", async () => {
        const establishmentAggregate = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder()
              .withMaxContactsPerMonth(24)
              .withLastInseeCheck(new Date("2020-04-14T12:00:00.000"))
              .withContactMode("IN_PERSON")
              .withWelcomeAddress({
                address: {
                  streetNumberAndAddress: "127 rue de Grenelle",
                  postcode: "75007",
                  city: "Paris",
                  departmentCode: "75",
                },
                position: { lat: 48.8566, lon: 2.3522 },
              })
              .build(),
          )
          .withUserRights([osefUserRight])
          .build();

        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentAggregate,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentAggregate],
        );
      });

      it("adds the establishment values in `establishments` table and keeps acquisition params", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishment(
            new EstablishmentEntityBuilder()
              .withMaxContactsPerMonth(24)
              .withLastInseeCheck(new Date("2020-04-14T12:00:00.000"))
              .build(),
          )
          .withAcquisition({
            acquisitionKeyword: "acquisition-keyword",
            acquisitionCampaign: "acquisition-campaign",
          })
          .withUserRights([osefUserRight])
          .build();

        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishment,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishment],
        );
      });

      it("adds one new row per establishment in `establishments` table when multiple establishments are given", async () => {
        const establishments = [
          new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret1)
                .withLocations([
                  {
                    id: "22222222-ee70-4c90-b3f4-668d492f7395",
                    position: { lat: 49, lon: 6 },
                    address: rueGuillaumeTellDto,
                  },
                ])
                .build(),
            )
            .withOffers([new OfferEntityBuilder().build()])
            .withUserRights([osefUserRight])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret2)
            .withOffers([new OfferEntityBuilder().build()])
            .withUserRights([osefUserRight])
            .build(),
        ];

        for (const establishment of establishments) {
          await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            establishment,
          );
        }

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          establishments,
        );
      });

      it("adds a new row in contact table with contact referencing the establishment siret", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(siret1)
          .withContactMode("EMAIL")
          .withUserRights([osefUserRight])
          .build();

        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishment,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishment],
        );
      });

      it("adds as many row as immersion offers in table `immersion_offers`, each referencing the establishment siret and the contact uuid", async () => {
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(siret1)
          .withOffers([
            new OfferEntityBuilder()
              .withRomeLabel("Stylisme")
              .withRomeCode("B1805")
              .withAppellationLabel("Styliste")
              .withAppellationCode("19540")
              .build(),
            new OfferEntityBuilder()
              .withRomeLabel("Stylisme")
              .withRomeCode("B1805")
              .withAppellationCode("19541")
              .withAppellationLabel("Styliste chaussure")
              .build(),
          ])
          .withUserRights([osefUserRight])
          .build();

        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishment,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishment],
        );
      });
      it("adds a new row in immersion_offers table with remote work mode", async () => {
        const offer = new OfferEntityBuilder()
          .withRemoteWorkMode("FULL_REMOTE")
          .build();
        const establishment = new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(siret1)
          .withOffers([offer])
          .withUserRights([osefUserRight])
          .build();
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishment,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishment],
        );
      });
    });

    describe("getEstablishmentAggregateBySiret bannishment info", () => {
      const establishment = new EstablishmentAggregateBuilder()
        .withUserRights([osefUserRight])
        .build();

      beforeEach(async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishment,
        );
      });

      it("returns bannishment field at false when establishment is not banned", async () => {
        expectToEqual(
          await pgEstablishmentAggregateRepository.getEstablishmentAggregateBySiret(
            establishment.establishment.siret,
          ),
          establishment,
        );
      });

      it("returns bannishment true and the justification when establishment is banned", async () => {
        const bannishmentJustification = "Fraude détectée lors d'un contrôle";
        await kyselyDb
          .insertInto("banned_establishments")
          .values({
            siret: establishment.establishment.siret,
            bannishment_justification: bannishmentJustification,
          })
          .execute();

        expectToEqual(
          await pgEstablishmentAggregateRepository.getEstablishmentAggregateBySiret(
            establishment.establishment.siret,
          ),
          {
            ...establishment,
            establishment: {
              ...establishment.establishment,
              isEstablishmentBanned: true,
              establishmentBannishmentJustification: bannishmentJustification,
            },
          },
        );
      });
    });

    describe("updateEstablishmentAggregate", () => {
      const user = new UserBuilder()
        .withId(uuid())
        .withEmail("email@mail.com")
        .build();

      const user2 = new UserBuilder()
        .withId(uuid())
        .withEmail("email2@mail.com")
        .build();

      const updatedAt = new Date();
      const aquisition: WithAcquisition = {
        acquisitionCampaign: "my-campaign",
        acquisitionKeyword: "my-keyword",
      };
      const analysteEnGeomatiqueImmersionOfferRemote = new OfferEntityBuilder()
        .withRomeLabel("Information géographique")
        .withRomeCode("M1808")
        .withAppellationLabel("Analyste en géomatique")
        .withAppellationCode("10946")
        .withRemoteWorkMode("FULL_REMOTE")
        .build();

      beforeEach(async () => {
        await pgUserRepository.save(user);
        await pgUserRepository.save(user2);
      });

      it.each([
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("78000403200029")
            .withEstablishmentCreatedAt(new Date("2021-01-15"))
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "aaaaaaaaaaaaa",
                phone: "+33600000000",
                userId: user.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                job: "aaaaaaaaaaaaa",
                phone: "+33600000000",
                userId: user2.id,
                shouldReceiveDiscussionNotifications: true,
              },
            ])
            .withOffers([analysteEnGeomatiqueImmersionOffer, cuvisteOffer])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("78000403200029")
            .withEstablishmentCreatedAt(new Date("2021-01-15"))
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "aaaaaaaaaaaaa",
                phone: "+33600000000",
                userId: user.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                job: "bbbbbbbbbb",
                phone: "+33600000099",
                userId: user2.id,
                shouldReceiveDiscussionNotifications: false,
              },
            ])
            .withOffers([
              analysteEnGeomatiqueImmersionOfferRemote,
              artisteCirqueOffer,
              cuvisteOffer,
            ])
            .build(),
          title: "add immersion offer on establishment",
        },
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("78000403200029")
            .withEstablishmentCreatedAt(new Date("2021-01-15"))
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "aaaaaaaaaaaaa",
                phone: "+33600000000",
                userId: user.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                job: "bbbbbbbbbbbbb",
                phone: "+33600000099",
                userId: user2.id,
                shouldReceiveDiscussionNotifications: false,
              },
            ])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("78000403200029")
            .withEstablishmentCreatedAt(new Date("2021-01-15"))
            .withEstablishmentUpdatedAt(updatedAt)
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                job: "sdlm!fjsdlfkjsdmlfj",
                phone: "+33666887744",
                userId: user.id,
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .withLocations([
              {
                id: "22222222-ee70-4c90-b3f4-668d492f7395",
                position: { lat: 49, lon: 6 },
                address: rueJacquardDto,
              },
              {
                id: "22222222-ee70-4c90-b3f4-668d492f7396",
                position: { lat: 49, lon: 6 },
                address: rueBitcheDto,
              },
            ])
            .withMaxContactsPerMonth(24)
            .withSearchableBy({
              jobSeekers: true,
              students: false,
            })
            .build(),
          title: "updates the establishment values",
        },
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentCustomizedName(
              "Activités des agences de travail temporaire",
            )
            .withUserRights([osefUserRight])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentCustomizedName(undefined)
            .withUserRights([osefUserRight])
            .withEstablishmentUpdatedAt(updatedAt)
            .build(),
          title: "removes customized name",
        },
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withContactMode("EMAIL")
            .withUserRights([osefUserRight])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withContactMode("IN_PERSON")
            .withEstablishmentWelcomeAddress({
              address: {
                streetNumberAndAddress: "127 rue de Grenelle",
                postcode: "75007",
                city: "Paris",
                departmentCode: "75",
              },
              position: { lat: 48.8566, lon: 2.3522 },
            })
            .withUserRights([osefUserRight])
            .withEstablishmentUpdatedAt(updatedAt)
            .build(),
          title: "updates an establishment existing contact",
        },
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withAdditionalInformation("my additionnal info")
                .withCustomizedName("my customize name")
                .withContactMode("IN_PERSON")
                .withFitForDisabledWorkers("yes-ft-certified")
                .withIsCommited(true)
                .withLastInseeCheck(new Date())
                .withNextAvailabilityDate(new Date())
                .withMaxContactsPerMonth(2)
                .withUpdatedAt(new Date())
                .withWelcomeAddress({
                  address: {
                    streetNumberAndAddress: "127 rue de Grenelle",
                    postcode: "75007",
                    city: "Paris",
                    departmentCode: "75",
                  },
                  position: { lat: 48.8566, lon: 2.3522 },
                })
                .withWebsite("https://www.truc.com")
                .withAcquisition(aquisition)
                .build(),
            )
            .withUserRights([osefUserRight])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishment(
              new EstablishmentEntityBuilder(
                new EstablishmentEntityBuilder()
                  .withAdditionalInformation("my additionnal info")
                  .withCustomizedName("my customize name")
                  .withFitForDisabledWorkers("yes-ft-certified")
                  .withIsCommited(true)
                  .withContactMode("EMAIL")
                  .withLastInseeCheck(new Date())
                  .withNextAvailabilityDate(new Date())
                  .withMaxContactsPerMonth(5)
                  .withUpdatedAt(new Date())
                  .withWebsite("https://www.truc.com")
                  .withAcquisition(aquisition)
                  .build(),
              )
                .withAdditionalInformation("")
                .withCustomizedName(undefined)
                .withIsCommited(undefined)
                .withLastInseeCheck(undefined)
                .withNextAvailabilityDate(undefined)
                .withUpdatedAt(updatedAt)
                .withWebsite(undefined)
                .withAcquisition(aquisition)
                .build(),
            )
            .withUserRights([osefUserRight])
            .build(),
          title: "remove optional values",
        },
        {
          originalEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentCustomizedName(
              "Activités des agences de travail temporaire",
            )
            .withUserRights([osefUserRight])
            .build(),
          updatedEstablishment: new EstablishmentAggregateBuilder()
            .withEstablishmentCustomizedName(undefined)
            .withUserRights([
              {
                ...osefUserRight,
                phone: "+33600000001",
              },
            ])
            .withEstablishmentUpdatedAt(updatedAt)
            .build(),
          title: "update user right phone number",
        },
      ] satisfies {
        originalEstablishment: EstablishmentAggregate;
        updatedEstablishment: EstablishmentAggregate;
        title: string;
      }[])("$title", async ({
        originalEstablishment,
        updatedEstablishment,
      }) => {
        // Prepare
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          originalEstablishment,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [originalEstablishment],
        );

        await pgEstablishmentAggregateRepository.updateEstablishmentAggregate(
          updatedEstablishment,
          updatedAt,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [updatedEstablishment],
        );

        const oldPhones = originalEstablishment.userRights
          .map((userRight) => userRight.phone)
          .filter((phone) => phone !== undefined);

        expect(await phoneNumbersExist(kyselyDb, oldPhones)).toBe(true);
      });
    });
  });

  describe("hasEstablishmentFromFormWithSiret", () => {
    it("returns false if no establishment from form with given siret exists", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.hasEstablishmentAggregateWithSiret(
          establishmentWithOfferA1101_AtPosition.establishment.siret,
        ),
        false,
      );
    });

    it("returns true if an establishment from form with given siret exists", async () => {
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithOfferA1101_AtPosition,
      );

      expectToEqual(
        await pgEstablishmentAggregateRepository.hasEstablishmentAggregateWithSiret(
          establishmentWithOfferA1101_AtPosition.establishment.siret,
        ),
        true,
      );
    });
  });

  describe("getSiretsOfEstablishmentsWithRomeCode", () => {
    it("Returns a list of establishment sirets that have an offer with given rome", async () => {
      // Prepare
      const matchingRomeCode = "A1101";
      const establishmentWithCodeOfferMatching =
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret("11111111111111")
          .withOffers([
            new OfferEntityBuilder()
              .withAppellationCode("11987")
              .withRomeCode(matchingRomeCode)
              .build(),
          ])
          .withLocationId(uuid())
          .withUserRights([osefUserRight])
          .build();
      const establishmentWithoutCodeOfferMatching =
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret("22222222222222")
          .withOffers([new OfferEntityBuilder().withRomeCode("A1201").build()])
          .withLocationId(uuid())
          .withUserRights([osefUserRight])
          .build();

      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithCodeOfferMatching,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithoutCodeOfferMatching,
      );

      // Assert
      expectToEqual(
        await pgEstablishmentAggregateRepository.getSiretsOfEstablishmentsWithRomeCode(
          matchingRomeCode,
        ),
        [establishmentWithCodeOfferMatching.establishment.siret],
      );
    });
  });

  describe("delete establishment aggregate", () => {
    it("Throws on missing establishment", async () => {
      const siretNotInTable = "11111111111111";

      await expectPromiseToFailWithError(
        pgEstablishmentAggregateRepository.delete(siretNotInTable),
        errors.establishment.notFound({ siret: siretNotInTable }),
      );
    });

    it("Delete aggregate including establishment, immersion offers, immersion contacts", async () => {
      const establishmentAggregate = new EstablishmentAggregateBuilder()
        .withSearchableBy({
          students: false,
          jobSeekers: false,
        })
        .withUserRights([osefUserRight])
        .build();

      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentAggregate,
      );

      expectToEqual(
        await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
        [establishmentAggregate],
      );

      await pgEstablishmentAggregateRepository.delete(
        establishmentAggregate.establishment.siret,
      );

      expectToEqual(
        await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
        [],
      );
    });

    it("Removes only establishment with given siret and its offers and its contacts", async () => {
      // Prepare

      const establishmentToRemove = new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("11111111111111")
        .withOffers([
          new OfferEntityBuilder()
            .withRomeCode("A1401")
            .withRomeLabel("Aide agricole de production fruitière ou viticole")
            .withAppellationCode("10806")
            .withAppellationLabel("Aide agricole en arboriculture")
            .build(),
          new OfferEntityBuilder()
            .withRomeCode("A1405")
            .withRomeLabel("Arboriculture et viticulture")
            .withAppellationCode("12112")
            .withAppellationLabel("Chef de culture arboricole")
            .build(),
        ])
        .withLocationId(uuid())
        .withUserRights([osefUserRight])
        .build();
      const establishmentToKeep = new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("22222222222222")
        .withOffers([
          new OfferEntityBuilder()
            .withRomeCode("A1405")
            .withRomeLabel("Arboriculture et viticulture")
            .withAppellationCode("17044")
            .withAppellationLabel("Oléiculteur / Oléicultrice")
            .build(),
        ])
        .withLocationId(uuid())
        .withUserRights([osefUserRight])
        .build();

      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentToRemove,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentToKeep,
      );

      expectToEqual(
        await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
        [establishmentToRemove, establishmentToKeep],
      );

      // Act
      await pgEstablishmentAggregateRepository.delete(
        establishmentToRemove.establishment.siret,
      );

      expectToEqual(
        await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
        [establishmentToKeep],
      );
    });
  });

  describe("getEstablishmentAggregates", () => {
    const user1 = new UserBuilder()
      .withId(uuid())
      .withEmail("existing@email-in-repo.fr")
      .build();
    const user2 = new UserBuilder()
      .withId(uuid())
      .withEmail("another@email-in-repo.fr")
      .build();

    const establishmentWithoutEmail = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("00000000000001")
      .withEstablishmentCreatedAt(new Date())
      .withLocationId(uuid())
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "doing stuff",
          phone: "+336887875544",
          userId: user1.id,
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
      ])
      .build();

    const establishmentWithUserId2_1 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("00000000000002")
      .withLocationId(uuid())
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "doing other stuff",
          phone: "+33688445577",
          userId: user2.id,
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
      ])
      .build();

    const establishmentWithUserId2_2 = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("00000000000003")
      .withLocationId(uuid())
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "doing other stuffffffffffffff",
          phone: "+33688445566",
          userId: user2.id,
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
      ])
      .build();

    const establishmentWithUserId2AndStatusPending =
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("00000000000007")
        .withLocationId(uuid())
        .withUserRights([
          {
            role: "establishment-admin",
            status: "PENDING",
            job: "doing other stuffffffffffffff",
            phone: "+33688445566",
            userId: user2.id,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .build();

    const establishmentFindableByName = new EstablishmentAggregateBuilder()
      .withEstablishmentName("establishmentFindableByName")
      .withLocationId(uuid())
      .withUserRights([osefUserRight])
      .build();

    const establishmentFindableBySiret = new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("00000000000004")
      .withLocationId(uuid())
      .withUserRights([osefUserRight])
      .build();

    const establishmentFindableByBothSiretAndName =
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret("00000000000005")
        .withEstablishmentName("establishmentFindableBothBySiretAndName")
        .withLocationId(uuid())
        .withUserRights([osefUserRight])
        .build();

    beforeEach(async () => {
      await pgUserRepository.save(user1);
      await pgUserRepository.save(user2);
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithoutEmail,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithUserId2_1,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithUserId2_2,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentWithUserId2AndStatusPending,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentFindableByName,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentFindableBySiret,
      );
      await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentFindableByBothSiretAndName,
      );
    });

    it("return empty list if no establishment matched", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            userId: uuid(),
          },
        ),
        [],
      );
    });

    it("return an establishmentAggregate if matched userId", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            userId: user2.id,
          },
        ),
        [
          establishmentWithUserId2_1,
          establishmentWithUserId2_2,
          establishmentWithUserId2AndStatusPending,
        ],
      );
    });

    it("return an establishmentAggregate if matched nameIncludes", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            nameIncludes: "FindableByName",
          },
        ),
        [establishmentFindableByName],
      );
    });
    it("return an establishmentAggregate if matched sirets", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            sirets: [establishmentFindableBySiret.establishment.siret],
          },
        ),
        [establishmentFindableBySiret],
      );
    });
    it("return an establishmentAggregate if matched both nameIncludes and sirets", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            nameIncludes: "BothBySiretAndName",
            sirets: [
              establishmentFindableByBothSiretAndName.establishment.siret,
            ],
          },
        ),
        [establishmentFindableByBothSiretAndName],
      );
    });
  });

  describe("markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth", () => {
    const now = new Date();
    const sinceOneWeekAgo = subDays(now, 7);
    const sinceOneMonthAgo = subDays(now, 30);

    const establishmentNotSearchable = new EstablishmentAggregateBuilder()
      .withUserRights([osefUserRight])
      .withIsMaxDiscussionsForPeriodReached(true)
      .build();

    const createEstablishmentAggregateWithMaxContactPerMonth = (
      maxContactsPerMonth: number,
    ) =>
      new EstablishmentAggregateBuilder(establishmentNotSearchable)
        .withMaxContactsPerMonth(maxContactsPerMonth)
        .withUserRights([osefUserRight])
        .build();

    const establishmentIsNotSearchableAndMaxContactPerMonth0 =
      createEstablishmentAggregateWithMaxContactPerMonth(0);
    const establishmentIsNotSearchableAndMaxContactPerMonth1 =
      createEstablishmentAggregateWithMaxContactPerMonth(1);
    const establishmentIsNotSearchableAndMaxContactPerMonth2 =
      createEstablishmentAggregateWithMaxContactPerMonth(2);
    const establishmentIsNotSearchableAndMaxContactPerMonth4 =
      createEstablishmentAggregateWithMaxContactPerMonth(4);
    const establishmentIsNotSearchableAndMaxContactPerMonth8 =
      createEstablishmentAggregateWithMaxContactPerMonth(8);

    const discussionAfterSinceOneMonthDate = new DiscussionBuilder()
      .withSiret(
        establishmentIsNotSearchableAndMaxContactPerMonth2.establishment.siret,
      )
      .withId(uuid())
      .withCreatedAt(addMilliseconds(sinceOneMonthAgo, 1))
      .build();
    const discussionAfterSinceAWeekDate = new DiscussionBuilder()
      .withSiret(
        establishmentIsNotSearchableAndMaxContactPerMonth2.establishment.siret,
      )
      .withId(uuid())
      .withCreatedAt(addMilliseconds(sinceOneWeekAgo, 1))
      .build();

    const discussionAtOneMonthSinceDate = new DiscussionBuilder()
      .withSiret(
        establishmentIsNotSearchableAndMaxContactPerMonth2.establishment.siret,
      )
      .withId(uuid())
      .withCreatedAt(sinceOneMonthAgo)
      .build();

    describe("update", () => {
      it(`update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 8
          - have 1 discussion since date`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth8,
        );

        // Create a discussion for the establishment with maxContactsPerMonth=8
        const discussionForEstablishment8 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth8.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceOneMonthAgo, 1))
          .build();

        await pgDiscussionRepository.insert(discussionForEstablishment8);

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        // The establishment should be made searchable again because 1 < Math.ceil(8/4) = 2
        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [
            new EstablishmentAggregateBuilder(
              establishmentIsNotSearchableAndMaxContactPerMonth8,
            )
              .withIsMaxDiscussionsForPeriodReached(false)
              .withFitForDisabledWorkers("no")
              .build(),
          ],
        );
      });

      it(`update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 2
          - have no discussion`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth2,
        );

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [
            new EstablishmentAggregateBuilder(
              establishmentIsNotSearchableAndMaxContactPerMonth2,
            )
              .withIsMaxDiscussionsForPeriodReached(false)
              .withFitForDisabledWorkers("no")
              .build(),
          ],
        );
      });
      it(`update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 1
          - have 1 discussion before date`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth1,
        );

        await pgDiscussionRepository.insert(discussionAtOneMonthSinceDate);

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [
            new EstablishmentAggregateBuilder(
              establishmentIsNotSearchableAndMaxContactPerMonth1,
            )
              .withIsMaxDiscussionsForPeriodReached(false)
              .withFitForDisabledWorkers("no")
              .build(),
          ],
        );
      });
      it(`update is searchable for establishments that: 
        - are not searchable
        - have maxContactsPerMonth at 8
        - have 4 discussion since date (2 first week, 2 second week)`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth8,
        );

        const sinceFourWeeksAgo = subDays(new Date(), 28);
        const sinceThreeWeeksAgo = subDays(new Date(), 21);
        // Create a discussion for the establishment with maxContactsPerMonth=8
        const discussion1ForEstablishment8 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth8.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceFourWeeksAgo, 1))
          .build();

        const discussion2ForEstablishment8 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth8.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceFourWeeksAgo, 10))
          .build();

        const discussion3ForEstablishment8 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth8.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceThreeWeeksAgo, 1))
          .build();

        const discussion4ForEstablishment8 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth8.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceThreeWeeksAgo, 10))
          .build();

        await pgDiscussionRepository.insert(discussion1ForEstablishment8);
        await pgDiscussionRepository.insert(discussion2ForEstablishment8);
        await pgDiscussionRepository.insert(discussion3ForEstablishment8);
        await pgDiscussionRepository.insert(discussion4ForEstablishment8);

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        // The establishment should be made searchable again because 1 < Math.ceil(8/4) = 2
        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [
            new EstablishmentAggregateBuilder(
              establishmentIsNotSearchableAndMaxContactPerMonth8,
            )
              .withIsMaxDiscussionsForPeriodReached(false)
              .withFitForDisabledWorkers("no")
              .build(),
          ],
        );
      });
    });

    describe("do not update", () => {
      it(`do not update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 0
          - have 0 discussion`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth0,
        );

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentIsNotSearchableAndMaxContactPerMonth0],
        );
      });

      it(`do not update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 0
          - have 1 discussion since date`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth0,
        );
        await pgDiscussionRepository.insert(discussionAfterSinceOneMonthDate);

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentIsNotSearchableAndMaxContactPerMonth0],
        );
      });

      it(`do not update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 1
          - have 1 discussion since date`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth1,
        );
        await pgDiscussionRepository.insert(discussionAfterSinceAWeekDate);

        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentIsNotSearchableAndMaxContactPerMonth1],
        );
      });

      it(`do not update is searchable for establishments that: 
          - are not searchable
          - have maxContactsPerMonth at 4
          - have 1 discussion since a week (which is under monthly max but at weekly max)`, async () => {
        await pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentIsNotSearchableAndMaxContactPerMonth4,
        );

        const discussionForEstablishment4 = new DiscussionBuilder()
          .withSiret(
            establishmentIsNotSearchableAndMaxContactPerMonth4.establishment
              .siret,
          )
          .withId(uuid())
          .withCreatedAt(addMilliseconds(sinceOneWeekAgo, 1))
          .build();

        await pgDiscussionRepository.insert(discussionForEstablishment4);
        await pgEstablishmentAggregateRepository.markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(
          now,
        );

        expectToEqual(
          await pgEstablishmentAggregateRepository.getAllEstablishmentAggregatesForTest(),
          [establishmentIsNotSearchableAndMaxContactPerMonth4],
        );
      });
    });
  });
  describe("getSiretsInRepoFromSiretList", () => {
    const existingSirets = [
      "00000000000001",
      "00000000000002",
      "00000000000003",
    ];
    const notExistingSirets = [
      "00000000000004",
      "00000000000005",
      "00000000000006",
    ];

    beforeEach(async () => {
      await Promise.all(
        existingSirets.map((siret) =>
          pgEstablishmentAggregateRepository.insertEstablishmentAggregate(
            new EstablishmentAggregateBuilder()
              .withEstablishmentSiret(siret)
              .withUserRights([osefUserRight])
              .withLocations([
                {
                  ...locationOfSearchPosition,
                  id: uuid(),
                },
              ])
              .build(),
          ),
        ),
      );
    });
    it("returns the sirets in the repo", async () => {
      expectArraysToEqualIgnoringOrder(
        await pgEstablishmentAggregateRepository.getSiretsInRepoFromSiretList([
          existingSirets[0],
          ...notExistingSirets,
          existingSirets[1],
          existingSirets[2],
        ]),
        existingSirets,
      );
    });
    it("returns an empty array if the sirets are not in the repo", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getSiretsInRepoFromSiretList(
          notExistingSirets,
        ),
        [],
      );
    });
    it("returns an empty array if an empty array is provided", async () => {
      expectToEqual(
        await pgEstablishmentAggregateRepository.getSiretsInRepoFromSiretList(
          [],
        ),
        [],
      );
    });
  });
});

const toReadableSearchResult = ({
  address,
  rome,
  distance_m,
}: InternalOfferDto) => ({
  address: `${address?.streetNumberAndAddress} ${address?.postcode} ${address?.city}`,
  rome,
  distance_m,
});
