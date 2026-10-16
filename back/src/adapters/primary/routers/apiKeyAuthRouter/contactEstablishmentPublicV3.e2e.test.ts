import {
  type ContactEstablishmentPublicV3Dto,
  errors,
  expectObjectsToMatch,
  expectToEqual,
  type PublicApiV3SearchEstablishmentRoutes,
  publicApiV3SearchEstablishmentRoutes,
  UserBuilder,
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
import {
  EstablishmentAggregateBuilder,
  EstablishmentEntityBuilder,
  OfferEntityBuilder,
  TEST_LOCATION,
} from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe("POST /v3/apply-to-offers public V3 route", () => {
  const user = new UserBuilder().build();
  const contactEstablishment: ContactEstablishmentPublicV3Dto = {
    contactMode: "EMAIL",
    kind: "IF",
    siret: "11112222333344",
    appellationCode: "19540",
    potentialBeneficiaryEmail: "john.doe@mail.com",
    potentialBeneficiaryFirstName: "John",
    potentialBeneficiaryLastName: "Doe",
    immersionObjective: "Confirmer un projet professionnel",
    potentialBeneficiaryPhone: "0654334567",
    locationId: TEST_LOCATION.id,
    datePreferences: "fake date preferences",
    experienceAdditionalInformation: "experienceAdditionalInformation",
  };

  let request: SuperTest<Test>;
  let generateApiConsumerJwt: GenerateApiConsumerJwt;
  let sharedRequest: HttpClient<PublicApiV3SearchEstablishmentRoutes>;
  let authToken: string;
  let inMemoryUow: InMemoryUnitOfWork;

  beforeEach(async () => {
    ({ request, generateApiConsumerJwt, inMemoryUow } = await buildTestApp(
      new AppConfigBuilder()
        .withRepositories("IN_MEMORY")
        .withAuthorizedApiKeyIds([authorizedUnJeuneUneSolutionApiConsumer.id])
        .build(),
    ));
    inMemoryUow.apiConsumerRepository.consumers = [
      authorizedUnJeuneUneSolutionApiConsumer,
      unauthorizedApiConsumer,
    ];
    inMemoryUow.userRepository.users = [user];
    authToken = generateApiConsumerJwt({
      id: authorizedUnJeuneUneSolutionApiConsumer.id,
      version: 1,
    });
    sharedRequest = createSupertestSharedClient(
      publicApiV3SearchEstablishmentRoutes,
      request,
    );
  });

  it("refuses to contact if no api key is provided", async () => {
    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: "",
      },
      body: contactEstablishment,
    });

    expectToEqual(body, { status: 401, message: "unauthenticated" });
    expectToEqual(status, 401);
  });

  it("returns 404 if siret not found", async () => {
    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: generateApiConsumerJwt({
          id: authorizedUnJeuneUneSolutionApiConsumer.id,
          version: 1,
        }),
      },
      body: contactEstablishment,
    });

    expectToEqual(body, {
      status: 404,
      message: errors.establishment.notFound({
        siret: contactEstablishment.siret,
      }).message,
    });
    expectToEqual(status, 404);
  });

  it("rejects unauthorized consumer", async () => {
    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: generateApiConsumerJwt({
          id: unauthorizedApiConsumer.id,
          version: 1,
        }),
      },
      body: contactEstablishment,
    });

    expectToEqual(body, {
      status: 403,
      message: "Accès refusé",
    });
    expectToEqual(status, 403);
  });

  it("rejects invalid requests with error code 400", async () => {
    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: authToken,
      },
      body: { ...contactEstablishment, contactMode: "wrong" as any },
    });

    expectToEqual(body, {
      status: 400,
      message:
        "Shared-route schema 'requestBodySchema' was not respected in adapter 'express'.\nRoute: POST /v3/apply-to-offer",
      issues: [
        "contactMode : Choisissez parmi les options proposées",
        // Issues below are useless and thrown by our new discussion schema,
        // we keep them as they are for now because otherwise we would have to change the schema to a less readable one
        'kind : Invalid input: expected "1_ELEVE_1_STAGE"',
        'immersionObjective : Invalid input: expected "Découvrir un métier ou un secteur d\'activité"',
        "levelOfEducation : Vous devez sélectionner une option parmi celles proposées",
      ],
    });
    expectToEqual(status, 400);
  });

  it("rejects invalid requests with mismatching contact Mode with error code 400", async () => {
    const establishmentAggregate = new EstablishmentAggregateBuilder()
      .withEstablishment(
        new EstablishmentEntityBuilder()
          .withSiret(contactEstablishment.siret)
          .withContactMode("PHONE")
          .withLocations([TEST_LOCATION])
          .withNumberOfEmployeeRange("10-19")
          .build(),
      )
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          userId: user.id,
          job: "",
          phone: "",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
      ])
      .withOffers([
        new OfferEntityBuilder()
          .withAppellationCode(contactEstablishment.appellationCode)
          .build(),
      ])
      .build();
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: authToken,
      },
      body: contactEstablishment,
    });

    expectToEqual(body, {
      status: 400,
      message: errors.establishment.contactRequestContactModeMismatch({
        contactModes: {
          inParams: contactEstablishment.contactMode,
          inRepo: establishmentAggregate.establishment.contactMode,
        },
        siret: contactEstablishment.siret,
      }).message,
    });
    expectToEqual(status, 400);
  });

  it("rejects invalid requests with mismatching appellation Code with error code 400", async () => {
    const testEstablishmentAppellationCode = "11704";
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(contactEstablishment.siret)
            .withContactMode("EMAIL")
            .withLocations([TEST_LOCATION])
            .withNumberOfEmployeeRange("10-19")
            .build(),
        )
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            userId: user.id,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .withOffers([
          new OfferEntityBuilder()
            .withAppellationCode(testEstablishmentAppellationCode)
            .build(),
        ])
        .build(),
    ];

    const { body, status } = await sharedRequest.contactEstablishment({
      headers: {
        authorization: authToken,
      },
      body: contactEstablishment,
    });

    expectToEqual(body, {
      status: 400,
      message: errors.establishment.offerMissing({
        siret: contactEstablishment.siret,
        appellationCode: contactEstablishment.appellationCode,
        mode: "bad request",
      }).message,
    });
    expectToEqual(status, 400);
  });

  it("contacts the establishment when everything goes right, and stores the consumer in acquisition params", async () => {
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(contactEstablishment.siret)
            .withContactMode("EMAIL")
            .withLocations([TEST_LOCATION])
            .withNumberOfEmployeeRange("10-19")
            .build(),
        )
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            userId: user.id,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .withOffers([
          new OfferEntityBuilder()
            .withAppellationCode(contactEstablishment.appellationCode)
            .build(),
        ])
        .build(),
    ];

    const { body, status } = await request
      .post("/v3/apply-to-offer")
      .set(
        "Authorization",
        generateApiConsumerJwt({
          id: authorizedUnJeuneUneSolutionApiConsumer.id,
          version: 1,
        }),
      )
      .send(contactEstablishment);

    expectToEqual(body, "");
    expectToEqual(status, 201);
    expect(inMemoryUow.discussionRepository.discussions).toHaveLength(1);
    const discussion = inMemoryUow.discussionRepository.discussions[0];
    expectObjectsToMatch(discussion, {
      siret: contactEstablishment.siret,
      acquisitionCampaign: "api-consumer",
      acquisitionKeyword: `${authorizedUnJeuneUneSolutionApiConsumer.id} - ${authorizedUnJeuneUneSolutionApiConsumer.name}`,
    });
  });

  it("contacts the establishment when everything goes right even without location id", async () => {
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishment(
          new EstablishmentEntityBuilder()
            .withSiret(contactEstablishment.siret)
            .withContactMode("EMAIL")
            .withLocations([TEST_LOCATION])
            .withNumberOfEmployeeRange("10-19")
            .build(),
        )
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            userId: user.id,
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .withOffers([
          new OfferEntityBuilder()
            .withAppellationCode(contactEstablishment.appellationCode)
            .build(),
        ])
        .build(),
    ];

    const { body, status } = await request
      .post("/v3/apply-to-offer")
      .set(
        "Authorization",
        generateApiConsumerJwt({
          id: authorizedUnJeuneUneSolutionApiConsumer.id,
          version: 1,
        }),
      )
      .send(contactEstablishment);

    expectToEqual(body, "");
    expectToEqual(status, 201);
  });
});
