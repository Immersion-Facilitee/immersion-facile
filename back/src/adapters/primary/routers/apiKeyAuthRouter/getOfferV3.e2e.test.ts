import {
  type AppellationAndRomeDto,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
  type Location,
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
import { TEST_ROME_LABEL } from "../../../../domains/establishment/adapters/InMemoryEstablishmentAggregateRepository";
import {
  defaultNafCode,
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
  TEST_LOCATION,
} from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { buildTestApp } from "../../../../utils/buildTestApp";
import type { SearchImmersionResultPublicV3 } from "../DtoAndSchemas/v3/output/SearchImmersionResultPublicV3.dto";
import {
  type PublicApiV3SearchEstablishmentRoutes,
  publicApiV3SearchEstablishmentRoutes,
} from "./publicApiV3.routes";

const styliste: AppellationAndRomeDto = {
  romeCode: "B1805",
  romeLabel: "Stylisme",
  appellationCode: "19540",
  appellationLabel: "Styliste",
};
const immersionOfferSiret = "78000403200019";

const otherLocation: Location = {
  id: "22222222-2222-4444-2222-222222222222",
  address: {
    city: "Marseille",
    departmentCode: "04",
    postcode: "04300",
    streetNumberAndAddress: "10 rue du vieux port",
  },
  position: { lat: 39.8666, lon: 8.3333 },
};

describe("Route to get ImmersionSearchResultDto by siret, appellation code and location Id - /v3/offers/:siret/:appellationCode/:locationId", () => {
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
            .withLocations([TEST_LOCATION, otherLocation])
            .withContactMode("EMAIL")
            .withNumberOfEmployeeRange("10-19")
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
    const siretNotInDB = "11000403200019";

    const response = await sharedRequest.getOffer({
      headers: {
        authorization: "",
      },
      urlParams: {
        appellationCode: styliste.appellationCode,
        siret: siretNotInDB,
        locationId: "truc",
      },
    });

    expectHttpResponseToEqual(response, {
      status: 401,
      body: { status: 401, message: "unauthenticated" },
    });
  });

  it("accepts valid authenticated requests", async () => {
    const response = await request
      .get(
        `/v3/offers/${immersionOfferSiret}/${styliste.appellationCode}/${otherLocation.id}`,
      )
      .set("Authorization", authToken);

    expectToEqual(response.body, {
      rome: styliste.romeCode,
      naf: defaultNafCode,
      siret: "78000403200019",
      name: "Company inside repository",
      voluntaryToImmersion: true,
      locationId: otherLocation.id,
      numberOfEmployeeRange: "10-19",
      address: otherLocation.address,
      contactMode: "EMAIL",
      romeLabel: TEST_ROME_LABEL,
      establishmentScore: 15,
      appellations: [
        {
          appellationLabel: styliste.appellationLabel,
          appellationCode: styliste.appellationCode,
        },
      ],
      nafLabel: "FAKE",
      additionalInformation: "",
      website: "",
      position: {
        lat: otherLocation.position.lat,
        lon: otherLocation.position.lon,
      },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      fitForDisabledWorkers: "no",
      remoteWorkMode: "ON_SITE",
      isAvailable: true,
    } satisfies SearchImmersionResultPublicV3);
    expect(response.status).toBe(200);
  });

  it("accepts valid authenticated requests with no location id", async () => {
    const response = await request
      .get(`/v3/offers/${immersionOfferSiret}/${styliste.appellationCode}`)
      .set("Authorization", authToken);

    expectToEqual(response.body, {
      rome: styliste.romeCode,
      naf: defaultNafCode,
      siret: "78000403200019",
      name: "Company inside repository",
      voluntaryToImmersion: true,
      locationId: otherLocation.id,
      numberOfEmployeeRange: "10-19",
      address: otherLocation.address,
      contactMode: "EMAIL",
      romeLabel: TEST_ROME_LABEL,
      establishmentScore: 15,
      appellations: [
        {
          appellationLabel: styliste.appellationLabel,
          appellationCode: styliste.appellationCode,
        },
      ],
      nafLabel: "FAKE",
      additionalInformation: "",
      website: "",
      position: {
        lat: otherLocation.position.lat,
        lon: otherLocation.position.lon,
      },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      fitForDisabledWorkers: "no",
      remoteWorkMode: "ON_SITE",
      isAvailable: true,
    } satisfies SearchImmersionResultPublicV3);
    expect(response.status).toBe(200);
  });

  it("returns 404 if no offer can be found with such siret & appellation code", async () => {
    const siretNotInDB = "11000403200019";

    const { status, body } = await sharedRequest.getOffer({
      headers: {
        authorization: authToken,
      },
      urlParams: {
        appellationCode: styliste.appellationCode,
        siret: siretNotInDB,
        locationId: otherLocation.id,
      },
    });

    expectToEqual(body, {
      message: errors.establishment.offerMissing({
        siret: siretNotInDB,
        appellationCode: styliste.appellationCode,
        mode: "not found",
      }).message,
      status: 404,
    });
    expectToEqual(status, 404);
  });

  it("return 403 if forbidden", async () => {
    const authToken = generateApiConsumerJwt({
      id: unauthorizedApiConsumer.id,
      version: 1,
    });

    const response = await sharedRequest.getOffer({
      headers: {
        authorization: authToken,
      },
      urlParams: {
        appellationCode: styliste.appellationCode,
        siret: immersionOfferSiret,
        locationId: otherLocation.id,
      },
    });

    expectHttpResponseToEqual(response, {
      status: 403,
      body: { message: "Accès refusé", status: 403 },
    });
  });
});
