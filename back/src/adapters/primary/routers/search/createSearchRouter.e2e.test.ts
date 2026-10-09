import {
  type AppellationAndRomeDto,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  type GetOffersFlatQueryParams,
  type Group,
  type InternalOfferDto,
  type Pagination,
  type SearchRoutes,
  type SiretDto,
  searchImmersionRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { establishmentAggregateToSearchResultByRomeForFirstLocation } from "../../../../domains/establishment/adapters/InMemoryEstablishmentAggregateRepository";
import { stubSearchResult } from "../../../../domains/establishment/adapters/InMemoryGroupRepository";
import type { LaBonneBoiteCompanyDto } from "../../../../domains/establishment/adapters/la-bonne-boite/LaBonneBoiteCompanyDto";
import { LaBonneBoiteCompanyDtoBuilder } from "../../../../domains/establishment/adapters/la-bonne-boite/LaBonneBoiteCompanyDtoBuilder";
import type { EstablishmentEntity } from "../../../../domains/establishment/entities/EstablishmentEntity";
import type { GroupEntity } from "../../../../domains/establishment/entities/GroupEntity";
import type { OfferEntity } from "../../../../domains/establishment/entities/OfferEntity";
import {
  defaultLocation,
  defaultNafCode,
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
} from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";

const siret1 = "12345678901234";
const siret2 = "11111111111111";
const siret3 = "12341234123455";
const unavailableEstablishmentSiret = "12341234123456";

const defaultUpdatedAt = new Date("2024-08-10");

const toSearchImmersionResults = (
  params: {
    siret: SiretDto;
    offer: OfferEntity;
    establishment: EstablishmentEntity;
  }[],
  withDistance: number | false,
): InternalOfferDto[] =>
  params.map(({ siret, offer, establishment }) => ({
    naf: defaultNafCode,
    nafLabel: "FAKE",
    name: "Company inside repository",
    website: "https://www.jobs.fr",
    additionalInformation: "",
    rome: offer.romeCode,
    romeLabel: "test_rome_label",
    appellations: [
      {
        appellationLabel: offer.appellationLabel,
        appellationCode: offer.appellationCode,
      },
    ],
    siret,
    establishmentScore: establishment.score,
    voluntaryToImmersion: true,
    contactMode: "EMAIL",
    numberOfEmployeeRange: "10-19",
    address: defaultLocation.address,
    position: defaultLocation.position,
    locationId: defaultLocation.id,
    ...(withDistance !== false ? { distance_m: withDistance } : {}),
    updatedAt: defaultUpdatedAt.toISOString(),
    createdAt: establishment.createdAt.toISOString(),
    fitForDisabledWorkers: "no",
    remoteWorkMode: offer.remoteWorkMode,
    isAvailable: !establishment.isMaxDiscussionsForPeriodReached,
  }));

const offer1 = new OfferEntityBuilder()
  .withRomeCode("A1409")
  .withAppellationCode("14704")
  .withRemoteWorkMode("ON_SITE")
  .build();

const offer2 = new OfferEntityBuilder()
  .withRomeCode("A1203")
  .withAppellationCode("16067")
  .withRemoteWorkMode("ON_SITE")
  .build();

const unavailableEstablishmentOffer = new OfferEntityBuilder()
  .withRomeCode("A1203")
  .withAppellationCode("16067")
  .withRemoteWorkMode("ON_SITE")
  .build();

const score20 = 20;

const establishment = new EstablishmentEntityBuilder()
  .withScore(score20)
  .build();

const immersionOffer = new OfferEntityBuilder()
  .withRemoteWorkMode("ON_SITE")
  .build();
const establishmentAggregate1 = new EstablishmentAggregateBuilder()
  .withEstablishment(
    new EstablishmentEntityBuilder()
      .withSiret("11112222333344")
      .withContactMode("EMAIL")
      .withScore(score20)
      .build(),
  )
  .withUserRights([
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      userId: "osef",
      job: "",
      phone: "",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ])
  .withOffers([immersionOffer])
  .build();

const establishmentAggregate2 = new EstablishmentAggregateBuilder()
  .withOffers([immersionOffer])
  .withEstablishment(
    new EstablishmentEntityBuilder()
      .withLocations([
        {
          position: {
            lat: 48.8531,
            lon: 2.34999,
          },
          address: {
            streetNumberAndAddress: "30 avenue des champs Elysées",
            city: "Paris",
            postcode: "75017",
            departmentCode: "75",
          },
          id: "1",
        },
      ])
      .withWebsite("https://www.jobs.fr")
      .withScore(score20)
      .build(),
  )
  .withUserRights([
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      userId: "osef",
      job: "",
      phone: "",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ])
  .build();

const unavailableEstablishmentAggregate = new EstablishmentAggregateBuilder()
  .withOffers([unavailableEstablishmentOffer])
  .withEstablishment(
    new EstablishmentEntityBuilder()
      .withSiret(unavailableEstablishmentSiret)
      .withIsMaxDiscussionsForPeriodReached(true)
      .withWebsite("https://www.jobs.fr")
      .build(),
  )
  .withUserRights([
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      userId: "osef",
      job: "",
      phone: "",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
  ])
  .build();

describe("/offers route", () => {
  let inMemoryUow: InMemoryUnitOfWork;
  let httpClient: HttpClient<SearchRoutes>;
  let gateways: InMemoryGateways;

  beforeEach(async () => {
    const testAppAndDeps = await buildTestApp();
    inMemoryUow = testAppAndDeps.inMemoryUow;
    httpClient = createSupertestSharedClient(
      searchImmersionRoutes,
      testAppAndDeps.request,
    );
    gateways = testAppAndDeps.gateways;
  });

  describe("from front - /offers", () => {
    describe("accepts valid requests", () => {
      it("with given appellationCode and without position, require sortBy param", async () => {
        const immersionOffer = new OfferEntityBuilder()
          .withRomeCode(establishmentAggregate2.offers[0].romeCode)
          .withAppellationCode(
            establishmentAggregate2.offers[0].appellationCode,
          )
          .withAppellationLabel("Coiffeur / Coiffeuse mixte")
          .build();

        // Prepare
        await inMemoryUow.establishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentAggregate2,
        );

        // Act and assert
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [immersionOffer.appellationCode],
            sortBy: "score",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            data: [
              establishmentAggregateToSearchResultByRomeForFirstLocation({
                establishmentAggregate: establishmentAggregate2,
                romeCode: immersionOffer.romeCode,
                remoteWorkMode: "ON_SITE",
              }),
            ],
            pagination: getBasicPagination(),
          },
        });
      });

      it("accepts more than 20 items in query params arrays", async () => {
        // Act and assert
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: Array(21).fill(immersionOffer.appellationCode),
            sortBy: "score",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            data: [],
            pagination: {
              ...getBasicPagination(),
              totalRecords: 0,
            },
          },
        });
      });

      it("with given appellationCode and position", async () => {
        const immersionOffer = new OfferEntityBuilder()
          .withRomeCode(establishmentAggregate2.offers[0].romeCode)
          .withAppellationCode(
            establishmentAggregate2.offers[0].appellationCode,
          )
          .withAppellationLabel("Coiffeur / Coiffeuse mixte")
          .build();

        // Prepare
        await inMemoryUow.establishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentAggregate2,
        );

        // Act and assert
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [immersionOffer.appellationCode],
            distanceKm: 30,
            longitude: 2.34999,
            latitude: 48.8531,
            sortBy: "distance",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            data: [
              establishmentAggregateToSearchResultByRomeForFirstLocation({
                establishmentAggregate: establishmentAggregate2,
                romeCode: immersionOffer.romeCode,
                remoteWorkMode: "ON_SITE",
                distance_m: 0,
              }),
            ],
            pagination: getBasicPagination(),
          },
        });
      });

      it("with no specified appellationCode", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            distanceKm: 30,
            longitude: 2.34999,
            latitude: 48.8531,
            sortBy: "distance",
          },
        });
        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            data: [],
            pagination: getBasicPagination({ totalRecords: 0 }),
          },
        });
      });

      it("sortBy score supported", async () => {
        const immersionOffer = new OfferEntityBuilder()
          .withRomeCode(establishmentAggregate2.offers[0].romeCode)
          .withAppellationCode(
            establishmentAggregate2.offers[0].appellationCode,
          )
          .withAppellationLabel("Coiffeur / Coiffeuse mixte")
          .build();

        await inMemoryUow.establishmentAggregateRepository.insertEstablishmentAggregate(
          establishmentAggregate2,
        );

        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [immersionOffer.appellationCode],
            distanceKm: 30,
            longitude: 2.34999,
            latitude: 48.8531,
            sortBy: "score",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({}),
            data: [
              establishmentAggregateToSearchResultByRomeForFirstLocation({
                establishmentAggregate: establishmentAggregate2,
                romeCode: immersionOffer.romeCode,
                remoteWorkMode: "ON_SITE",
                distance_m: 0,
              }),
            ],
          },
        });
      });
    });

    describe("with filter searchableBy", () => {
      beforeEach(async () => {
        inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret1)
            .withOffers([offer1])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret1)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret2)
            .withOffers([offer2])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret2)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .withSearchableBy({ students: true, jobSeekers: false })
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret3)
            .withOffers([offer1])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret3)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .withSearchableBy({ students: false, jobSeekers: true })
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
        ];
      });

      it("with filter searchableBy defined to students", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [offer1.appellationCode, offer2.appellationCode],
            distanceKm: 30,
            longitude: defaultLocation.position.lon,
            latitude: defaultLocation.position.lat,
            sortBy: "distance",
            searchableBy: "students",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 2 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret2, offer: offer2, establishment },
              ],
              0,
            ),
          },
        });
      });

      it("with filter searchableBy defined to jobSeekers", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [offer1.appellationCode, offer2.appellationCode],
            distanceKm: 30,
            longitude: defaultLocation.position.lon,
            latitude: defaultLocation.position.lat,
            sortBy: "distance",
            searchableBy: "jobSeekers",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 2 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret3, offer: offer1, establishment },
              ],
              0,
            ),
          },
        });
      });

      it("with filter searchableBy not defined", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [offer1.appellationCode, offer2.appellationCode],
            distanceKm: 30,
            longitude: defaultLocation.position.lon,
            latitude: defaultLocation.position.lat,
            sortBy: "distance",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 3 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret2, offer: offer2, establishment },
                { siret: siret3, offer: offer1, establishment },
              ],
              0,
            ),
          },
        });
      });
    });

    describe("with filter remoteWorkModes", () => {
      const offerFullRemote = new OfferEntityBuilder()
        .withRomeCode("M1805")
        .withAppellationLabel("Développeur / Développeuse")
        .withAppellationCode("19999")
        .withRomeLabel("Études et développement informatique")
        .withRemoteWorkMode("FULL_REMOTE")
        .build();

      const offerHybrid = new OfferEntityBuilder()
        .withRomeCode("M1805")
        .withAppellationLabel("Chef de projet")
        .withAppellationCode("19998")
        .withRomeLabel("Gestion de projet")
        .withRemoteWorkMode("HYBRID")
        .build();

      const offerNoRemote = new OfferEntityBuilder()
        .withRomeCode("A1409")
        .withAppellationLabel("Ouvrier agricole")
        .withAppellationCode("14704")
        .withRomeLabel("Agriculture")
        .withRemoteWorkMode("ON_SITE")
        .build();

      beforeEach(async () => {
        inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret1)
            .withOffers([offerFullRemote, offerHybrid])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret1)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret2)
            .withOffers([offerNoRemote])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret2)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
        ];
      });

      it("with filter remoteWorkModes set to FULL_REMOTE", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [
              offerFullRemote.appellationCode,
              offerHybrid.appellationCode,
              offerNoRemote.appellationCode,
            ],
            sortBy: "score",
            remoteWorkModes: ["FULL_REMOTE"],
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 1 }),
            data: [
              {
                ...toSearchImmersionResults(
                  [{ siret: siret1, offer: offerFullRemote, establishment }],
                  false,
                )[0],
                remoteWorkMode: "FULL_REMOTE",
                appellations: [
                  {
                    appellationLabel: offerFullRemote.appellationLabel,
                    appellationCode: offerFullRemote.appellationCode,
                  },
                ],
              },
            ],
          },
        });
      });

      it("with filter remoteWorkModes set to multiple values", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [
              offerFullRemote.appellationCode,
              offerHybrid.appellationCode,
              offerNoRemote.appellationCode,
            ],
            sortBy: "score",
            remoteWorkModes: ["FULL_REMOTE", "HYBRID"],
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 2 }),
            data: [
              {
                ...toSearchImmersionResults(
                  [{ siret: siret1, offer: offerFullRemote, establishment }],
                  false,
                )[0],
                remoteWorkMode: "FULL_REMOTE",
                appellations: [
                  {
                    appellationLabel: offerFullRemote.appellationLabel,
                    appellationCode: offerFullRemote.appellationCode,
                  },
                ],
              },
              {
                ...toSearchImmersionResults(
                  [{ siret: siret1, offer: offerHybrid, establishment }],
                  false,
                )[0],
                remoteWorkMode: "HYBRID",
                appellations: [
                  {
                    appellationLabel: offerHybrid.appellationLabel,
                    appellationCode: offerHybrid.appellationCode,
                  },
                ],
              },
            ],
          },
        });
      });

      it("with filter remoteWorkModes set to ON_SITE", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [
              offerFullRemote.appellationCode,
              offerHybrid.appellationCode,
              offerNoRemote.appellationCode,
            ],
            sortBy: "score",
            remoteWorkModes: ["ON_SITE"],
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 1 }),
            data: toSearchImmersionResults(
              [{ siret: siret2, offer: offerNoRemote, establishment }],
              false,
            ).map((result) => ({
              ...result,
              remoteWorkMode: "ON_SITE" as const,
            })),
          },
        });
      });

      it("without remoteWorkModes filter returns all offers", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: [
              offerFullRemote.appellationCode,
              offerHybrid.appellationCode,
              offerNoRemote.appellationCode,
            ],
            sortBy: "score",
          },
        });

        expectHttpResponseToEqual(result, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 3 }),
            data: [
              {
                ...toSearchImmersionResults(
                  [{ siret: siret1, offer: offerFullRemote, establishment }],
                  false,
                )[0],
                remoteWorkMode: "FULL_REMOTE",
                appellations: [
                  {
                    appellationLabel: offerFullRemote.appellationLabel,
                    appellationCode: offerFullRemote.appellationCode,
                  },
                ],
              },
              {
                ...toSearchImmersionResults(
                  [{ siret: siret1, offer: offerHybrid, establishment }],
                  false,
                )[0],
                remoteWorkMode: "HYBRID",
                appellations: [
                  {
                    appellationLabel: offerHybrid.appellationLabel,
                    appellationCode: offerHybrid.appellationCode,
                  },
                ],
              },
              {
                ...toSearchImmersionResults(
                  [{ siret: siret2, offer: offerNoRemote, establishment }],
                  false,
                )[0],
                remoteWorkMode: "ON_SITE",
              },
            ],
          },
        });
      });
    });

    it("rejects invalid requests with error code 400", async () => {
      const result = await httpClient.getOffers({
        queryParams: {
          distanceKm: 30,
          longitude: 2.34999,
          latitude: 48.8531,
          sortBy: "distance",
          appellationCodes: ["XXX"],
        },
      });
      expectHttpResponseToEqual(result, {
        status: 400,
        body: {
          status: 400,
          issues: ["appellationCodes.0 : Code appellation incorrect"],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /offers",
        },
      });
    });
    describe("without geo params", () => {
      beforeEach(async () => {
        inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret1)
            .withOffers([offer1])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret1)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret2)
            .withOffers([offer2])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret2)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .withSearchableBy({ students: true, jobSeekers: false })
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
          new EstablishmentAggregateBuilder()
            .withEstablishmentSiret(siret3)
            .withOffers([offer1])
            .withEstablishment(
              new EstablishmentEntityBuilder()
                .withSiret(siret3)
                .withScore(score20)
                .withWebsite("https://www.jobs.fr")
                .withSearchableBy({ students: false, jobSeekers: true })
                .build(),
            )
            .withUserRights([
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "osef",
                job: "",
                phone: "",
                shouldReceiveDiscussionNotifications: true,
                isMainContactByPhone: false,
              },
            ])
            .build(),
        ];
      });
      it("should return 400 if distance is supplied but no lat/lon/distanceKm", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: ["14704"],
            sortBy: "distance",
          } as unknown as GetOffersFlatQueryParams, // forcing the type to check the error
        });
        expectHttpResponseToEqual(result, {
          status: 400,
          body: {
            status: 400,
            issues: [
              "latitude : Invalid input: expected number, received NaN",
              "longitude : Invalid input: expected number, received NaN",
              "distanceKm : Invalid input: expected number, received NaN",
            ],
            message:
              "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /offers",
          },
        });
      });
      it("should return 400 if distance is supplied but only lat", async () => {
        const result = await httpClient.getOffers({
          queryParams: {
            appellationCodes: ["14704"],
            sortBy: "distance",
            latitude: 48.8531,
          } as unknown as GetOffersFlatQueryParams, // forcing the type to check the error
        });
        expectHttpResponseToEqual(result, {
          status: 400,
          body: {
            status: 400,
            issues: [
              "longitude : Invalid input: expected number, received NaN",
              "distanceKm : Invalid input: expected number, received NaN",
            ],
            message:
              "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /offers",
          },
        });
      });
      it("should return results if no geo params are set and no appellations", async () => {
        const results = await httpClient.getOffers({
          queryParams: {
            sortBy: "score",
          },
        });

        expectHttpResponseToEqual(results, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 3 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret2, offer: offer2, establishment },
                { siret: siret3, offer: offer1, establishment },
              ],
              false,
            ),
          },
        });
      });
      it("should return also unavailable results if explicitly requested (showOnlyAvailableOffers is false)", async () => {
        inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
          ...inMemoryUow.establishmentAggregateRepository
            .establishmentAggregates,
          unavailableEstablishmentAggregate,
        ];
        const results = await httpClient.getOffers({
          queryParams: {
            sortBy: "score",
            showOnlyAvailableOffers: false,
          },
        });

        expectHttpResponseToEqual(results, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 4 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret2, offer: offer2, establishment },
                { siret: siret3, offer: offer1, establishment },
                {
                  siret: unavailableEstablishmentSiret,
                  offer: unavailableEstablishmentOffer,
                  establishment:
                    unavailableEstablishmentAggregate.establishment,
                },
              ],
              false,
            ),
          },
        });
      });
      it("should return results if no geo params are set but appellations are supplied", async () => {
        const results = await httpClient.getOffers({
          queryParams: {
            sortBy: "date",
            appellationCodes: [offer1.appellationCode],
          },
        });

        expectHttpResponseToEqual(results, {
          status: 200,
          body: {
            pagination: getBasicPagination({ totalRecords: 2 }),
            data: toSearchImmersionResults(
              [
                { siret: siret1, offer: offer1, establishment },
                { siret: siret3, offer: offer1, establishment },
              ],
              false,
            ),
          },
        });
      });
    });
  });

  describe("GET getGroupBySlug", () => {
    it("should get the stubbed data", async () => {
      const group: Group = {
        name: "Décathlon",
        slug: "decathlon",
        options: {
          heroHeader: {
            title: "Décathlon de ouf",
            description: "À fond la forme",
            logoUrl: "https://logo-decathlon.com",
          },
        },
      };
      const groupEntity: GroupEntity = {
        ...group,
        sirets: [stubSearchResult.siret],
      };

      inMemoryUow.groupRepository.groupEntities = [groupEntity];
      const result = await httpClient.getGroupBySlug({
        urlParams: {
          groupSlug: groupEntity.slug,
        },
      });
      expectHttpResponseToEqual(result, {
        status: 200,
        body: {
          group,
          results: [stubSearchResult],
        },
      });
    });
  });

  describe(`${searchImmersionRoutes.getSearchResult.method} ${searchImmersionRoutes.getSearchResult.url}`, () => {
    let inMemoryUow: InMemoryUnitOfWork;

    beforeEach(async () => {
      const testAppAndDeps = await buildTestApp();
      const request = testAppAndDeps.request;
      httpClient = createSupertestSharedClient(searchImmersionRoutes, request);
      inMemoryUow = testAppAndDeps.inMemoryUow;
    });

    it("200 - route with mandatory params", async () => {
      inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate2,
        establishmentAggregate1,
      ];

      const response = await httpClient.getSearchResult({
        queryParams: {
          siret: establishmentAggregate1.establishment.siret,
          appellationCode: establishmentAggregate1.offers[0].appellationCode,
          locationId: defaultLocation.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          additionalInformation: "",
          address: {
            city: "Paris",
            departmentCode: "75",
            postcode: "75017",
            streetNumberAndAddress: "30 avenue des champs Elysées",
          },
          establishmentScore: score20,
          appellations: [
            {
              appellationCode: "19540",
              appellationLabel: "Styliste",
            },
          ],
          contactMode: "EMAIL",
          naf: "7820Z",
          nafLabel: "FAKE",
          name: "Company inside repository",
          numberOfEmployeeRange: "10-19",
          position: {
            lat: 48.866667,
            lon: 2.333333,
          },
          rome: "B1805",
          romeLabel: "test_rome_label",
          siret: "11112222333344",
          voluntaryToImmersion: true,
          website: "",
          locationId: defaultLocation.id,
          updatedAt: defaultUpdatedAt.toISOString(),
          createdAt: new Date("2024-08-08").toISOString(),
          fitForDisabledWorkers: "no",
          remoteWorkMode: "ON_SITE",
          isAvailable: true,
        },
      });
    });

    it("400 - route without mandatory fields or invalid fields", async () => {
      const response = await httpClient.getSearchResult({
        queryParams: {
          siret: "my-fake-siret",
          appellationCode: "",
          locationId: defaultLocation.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: [
            "appellationCode : Code appellation incorrect",
            "siret : SIRET doit être composé de 14 chiffres",
          ],
          message: `Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /search-result`,
          status: 400,
        },
      });
    });

    it("404 - route with valid mandatory fields but offer not in repo", async () => {
      const requestedOffer = {
        siret: establishmentAggregate1.establishment.siret,
        appellationCode: establishmentAggregate1.offers[0].appellationCode,
      };

      const response = await httpClient.getSearchResult({
        queryParams: {
          siret: requestedOffer.siret,
          appellationCode: requestedOffer.appellationCode,
          locationId: defaultLocation.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.establishment.offerMissing({
            siret: requestedOffer.siret,
            appellationCode: requestedOffer.appellationCode,
            mode: "not found",
          }).message,
        },
      });
    });

    it("404 - route with valid mandatory fields and siret in repo but appellation is not found for establishment", async () => {
      inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate2,
        establishmentAggregate1,
      ];
      const appellationCodeNotFoundForEstablishment = "54321";
      const requestedOffer = {
        siret: establishmentAggregate1.establishment.siret,
        appellationCode: appellationCodeNotFoundForEstablishment,
      };

      const response = await httpClient.getSearchResult({
        queryParams: {
          siret: requestedOffer.siret,
          appellationCode: requestedOffer.appellationCode,
          locationId: defaultLocation.id,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.establishment.offerMissing({
            siret: requestedOffer.siret,
            appellationCode: requestedOffer.appellationCode,
            mode: "not found",
          }).message,
        },
      });
    });
  });

  describe(`${displayRouteName(
    searchImmersionRoutes.getExternalSearchResult,
  )}`, () => {
    it("404 - when siret not found", async () => {
      const response = await httpClient.getExternalSearchResult({
        queryParams: {
          siret: "11112222000044",
          appellationCode: "12694",
        },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message:
            "Aucune entreprise trouvée avec le siret : 11112222000044. Êtes-vous sûr d'avoir bien tapé votre siret ?",
        },
      });
    });

    it("200 - route with mandatory params", async () => {
      const styliste: AppellationAndRomeDto = {
        romeCode: "B1805",
        appellationLabel: "Styliste",
        appellationCode: "19540",
        romeLabel: "Stylisme",
      };
      const lbbResult: LaBonneBoiteCompanyDto =
        new LaBonneBoiteCompanyDtoBuilder().build();
      gateways.laBonneBoiteGateway.setNextResults([lbbResult]);

      const response = await httpClient.getExternalSearchResult({
        queryParams: {
          siret: lbbResult.siret,
          appellationCode: styliste.appellationCode,
        },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          ...lbbResult.toSearchResult(styliste),
          romeLabel: styliste.romeLabel,
          rome: styliste.romeCode,
        },
      });
    });
  });
});

describe(`${displayRouteName(searchImmersionRoutes.getExternalOffers)}`, () => {
  let inMemoryUow: InMemoryUnitOfWork;
  let httpClient: HttpClient<SearchRoutes>;
  let gateways: InMemoryGateways;
  beforeEach(async () => {
    const testAppAndDeps = await buildTestApp();
    inMemoryUow = testAppAndDeps.inMemoryUow;
    httpClient = createSupertestSharedClient(
      searchImmersionRoutes,
      testAppAndDeps.request,
    );
    gateways = testAppAndDeps.gateways;
  });

  describe("wrong paths", () => {
    it("400 - no geo params", async () => {
      const result = await httpClient.getExternalOffers({
        queryParams: {
          appellationCode: "14704",
          sortBy: "distance",
          distanceKm: 10,
        } as any,
      });
      inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate2,
        establishmentAggregate1,
      ];
      gateways.laBonneBoiteGateway.setNextResults([{} as any]);
      expectHttpResponseToEqual(result, {
        status: 400,
        body: {
          status: 400,
          issues: [
            "latitude : Invalid input: expected number, received NaN",
            "longitude : Invalid input: expected number, received NaN",
          ],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /external-offers",
        },
      });
    });
    it("400 - invalid geo params (distanceKm 0)", async () => {
      const result = await httpClient.getExternalOffers({
        queryParams: {
          appellationCode: "14704",
          distanceKm: 0,
          latitude: 48.8531,
          longitude: 2.34999,
        },
      });
      inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregate2,
        establishmentAggregate1,
      ];
      gateways.laBonneBoiteGateway.setNextResults([{} as any]);
      expectHttpResponseToEqual(result, {
        status: 400,
        body: {
          status: 400,
          issues: ["distanceKm : Cette valeur doit être positive"],
          message:
            "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /external-offers",
        },
      });
    });
    it("400 - appellation code not found", async () => {
      const appellationCodeNotFound = "99999";
      const result = await httpClient.getExternalOffers({
        queryParams: {
          appellationCode: appellationCodeNotFound,
          distanceKm: 10,
          latitude: 48.8531,
          longitude: 2.34999,
        },
      });
      expectHttpResponseToEqual(result, {
        status: 400,
        body: {
          status: 400,
          message: "No Rome code matching appellation codes 99999",
        },
      });
    });
  });
  describe("valid paths", () => {
    it("200 - route with mandatory params", async () => {
      const lbbResult: LaBonneBoiteCompanyDto =
        new LaBonneBoiteCompanyDtoBuilder().withRome("A1409").build();
      gateways.laBonneBoiteGateway.setNextResults([lbbResult]);
      const result = await httpClient.getExternalOffers({
        queryParams: {
          appellationCode: "14704",
          distanceKm: 10,
          latitude: 48.8531,
          longitude: 2.34999,
        },
      });
      expectHttpResponseToEqual(result, {
        status: 200,
        body: [
          {
            ...lbbResult.toSearchResult({
              romeCode: expect.any(String),
              romeLabel: expect.any(String),
            }),
            distance_m: 276612,
          },
        ],
      });
    });
    it("200 - empty results", async () => {
      gateways.laBonneBoiteGateway.setNextResults([]);
      const result = await httpClient.getExternalOffers({
        queryParams: {
          appellationCode: "19540",
          distanceKm: 10,
          latitude: 48.8531,
          longitude: 2.34999,
        },
      });
      expectHttpResponseToEqual(result, {
        status: 200,
        body: [],
      });
    });
  });
});

const getBasicPagination = (params: Partial<Pagination> = {}) => ({
  totalRecords: 1,
  currentPage: 1,
  totalPages: 1,
  numberPerPage: 12,
  ...params,
});
