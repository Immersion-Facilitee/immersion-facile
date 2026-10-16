import {
  type AppellationAndRomeDto,
  expectHttpResponseToEqual,
  expectToEqual,
  type PublicApiV3SearchEstablishmentRoutes,
  publicApiV3SearchEstablishmentRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import {
  authorizedUnJeuneUneSolutionApiConsumer,
  unauthorizedApiConsumer,
} from "../../../../domains/core/api-consumer/adapters/InMemoryApiConsumerRepository";
import type { GenerateApiConsumerJwt } from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { unavailableEstablishment } from "../../../../domains/establishment/adapters/PgEstablishmentAggregateRepository.test.helpers";
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
  TEST_LOCATION,
} from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { buildTestApp } from "../../../../utils/buildTestApp";

const styliste: AppellationAndRomeDto = {
  romeCode: "B1805",
  romeLabel: "Stylisme",
  appellationCode: "19540",
  appellationLabel: "Styliste",
};
const immersionOfferSiret = "78000403200019";

describe("GET /v3/offers", () => {
  let request: SuperTest<Test>;
  let inMemoryUow: InMemoryUnitOfWork;
  let generateApiConsumerJwt: GenerateApiConsumerJwt;
  let authToken: string;
  let sharedRequest: HttpClient<PublicApiV3SearchEstablishmentRoutes>;

  beforeEach(async () => {
    const config = new AppConfigBuilder()
      .withRepositories("IN_MEMORY")
      .withAuthorizedApiKeyIds([authorizedUnJeuneUneSolutionApiConsumer.id])
      .build();
    ({ request, inMemoryUow, generateApiConsumerJwt } =
      await buildTestApp(config));
    authToken = generateApiConsumerJwt({
      id: authorizedUnJeuneUneSolutionApiConsumer.id,
      version: 1,
    });

    sharedRequest = createSupertestSharedClient(
      publicApiV3SearchEstablishmentRoutes,
      request,
    );
    inMemoryUow.apiConsumerRepository.consumers = [
      unauthorizedApiConsumer,
      authorizedUnJeuneUneSolutionApiConsumer,
    ];
    await inMemoryUow.establishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(immersionOfferSiret)
            .withScore(15)
            .withLocations([TEST_LOCATION])
            .withContactMode("EMAIL")
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
        .withOffers([
          new OfferEntityBuilder()
            .withRomeCode(styliste.romeCode)
            .withAppellationCode(styliste.appellationCode)
            .withAppellationLabel(styliste.appellationLabel)
            .build(),
        ])
        .build(),
    );
  });

  it("rejects unauthenticated requests", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: "" },
      queryParams: { sortBy: "score", sortOrder: "desc" },
    });

    expectHttpResponseToEqual(response, {
      status: 401,
      body: { status: 401, message: "unauthenticated" },
    });
  });

  it("rejects unauthorized consumer", async () => {
    const unauthorizedToken = generateApiConsumerJwt({
      id: unauthorizedApiConsumer.id,
      version: 1,
    });

    const response = await sharedRequest.getOffers({
      headers: { authorization: unauthorizedToken },
      queryParams: { sortBy: "score", sortOrder: "desc" },
    });

    expectHttpResponseToEqual(response, {
      status: 403,
      body: { status: 403, message: "Accès refusé" },
    });
  });

  it("returns offers and stores apiConsumerName in search_made", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: { sortBy: "score", sortOrder: "desc" },
    });

    expectToEqual(response.status, 200);
    if (response.status !== 200) throw new Error("Expected 200");
    expectToEqual(response.body.data.length, 1);
    expectToEqual(response.body.data[0].siret, immersionOfferSiret);

    expectToEqual(inMemoryUow.searchMadeRepository.searchesMade.length, 1);
    expectToEqual(
      inMemoryUow.searchMadeRepository.searchesMade[0].apiConsumerName,
      authorizedUnJeuneUneSolutionApiConsumer.name,
    );
  });

  it("returns only available offers as default behavior", async () => {
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      ...inMemoryUow.establishmentAggregateRepository.establishmentAggregates,
      unavailableEstablishment,
    ];
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: {
        sortBy: "date",
      },
    });
    expectHttpResponseToEqual(response, {
      status: 200,
      body: {
        data: [
          {
            additionalInformation: "",
            address: {
              city: "Paris",
              departmentCode: "75",
              postcode: "75017",
              streetNumberAndAddress: "30 avenue des champs Elysées",
            },
            appellations: [
              {
                appellationCode: "19540",
                appellationLabel: "Styliste",
              },
            ],
            contactMode: "EMAIL",
            createdAt: "2024-08-08T00:00:00.000Z",
            establishmentScore: 15,
            fitForDisabledWorkers: "no",
            isAvailable: true,
            locationId: "11111111-1111-4444-1111-111111111111",
            naf: "7820Z",
            nafLabel: "FAKE",
            name: "Company inside repository",
            numberOfEmployeeRange: "10-19",
            position: {
              lat: 43.8666,
              lon: 8.3333,
            },
            remoteWorkMode: "ON_SITE",
            rome: "B1805",
            romeLabel: "test_rome_label",
            siret: "78000403200019",
            updatedAt: "2024-08-10T00:00:00.000Z",
            voluntaryToImmersion: true,
            website: "",
          },
        ],
        pagination: {
          currentPage: 1,
          numberPerPage: 100,
          totalPages: 1,
          totalRecords: 1,
        },
      },
    });
  });

  it("stores geo params when provided", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: {
        sortBy: "distance",
        sortOrder: "asc",
        latitude: 48.8566,
        longitude: 2.3522,
        distanceKm: 100,
      },
    });

    expectToEqual(response.status, 200);
    expectToEqual(inMemoryUow.searchMadeRepository.searchesMade.length, 1);

    const searchMade = inMemoryUow.searchMadeRepository.searchesMade[0] as {
      lat: number;
      lon: number;
      distanceKm: number;
    };
    expectToEqual(searchMade.lat, 48.8566);
    expectToEqual(searchMade.lon, 2.3522);
    expectToEqual(searchMade.distanceKm, 100);
  });

  it("stores place when provided", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: {
        sortBy: "score",
        sortOrder: "desc",
        place: "Paris, France",
      },
    });

    expectToEqual(response.status, 200);
    expectToEqual(inMemoryUow.searchMadeRepository.searchesMade.length, 1);
    expectToEqual(
      inMemoryUow.searchMadeRepository.searchesMade[0].place,
      "Paris, France",
    );
  });

  it("should filter offers on department codes", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: {
        sortBy: "score",
        sortOrder: "desc",
        departmentCodes: ["75"],
      },
    });

    expectToEqual(response.status, 200);
    expectToEqual(inMemoryUow.searchMadeRepository.searchesMade.length, 1);
    expectToEqual(
      inMemoryUow.searchMadeRepository.searchesMade[0].departmentCodes,
      ["75"],
    );
  });

  it("rejects invalid departmentCodes values", async () => {
    const response = await sharedRequest.getOffers({
      headers: { authorization: authToken },
      queryParams: {
        sortBy: "score",
        sortOrder: "desc",
        departmentCodes: [""],
      },
    });

    expectToEqual(response.status, 400);
  });
});
