import { addDays, subDays } from "date-fns";
import {
  authExpiredMessage,
  ConnectedUserBuilder,
  type ConnectedUserJwtPayload,
  currentJwtVersions,
  displayRouteName,
  type EstablishmentRoutes,
  errors,
  establishmentRoutes,
  expectHttpResponseToEqual,
  expectToEqual,
  UserBuilder,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import type { GenerateConnectedUserJwt } from "../../../../domains/core/jwt";
import type { CustomTimeGateway } from "../../../../domains/core/time-gateway/adapters/CustomTimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { EstablishmentAggregateBuilder } from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { createConnectedUserJwtPayload } from "../../../../utils/jwt";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("Delete establishment", () => {
  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin-user")
    .withIsAdmin(true)
    .buildUser();

  const backofficeAdminJwtPayload: ConnectedUserJwtPayload = {
    version: currentJwtVersions.connectedUser,
    iat: Date.now(),
    exp: addDays(new Date(), 30).getTime(),
    userId: backofficeAdminUser.id,
  };

  const user = new UserBuilder().build();

  const establishmentAggregate = new EstablishmentAggregateBuilder()
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "fsd",
        phone: "+66",
        userId: user.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
    ])
    .build();

  let httpClient: HttpClient<EstablishmentRoutes>;
  let uow: InMemoryUnitOfWork;
  let gateways: InMemoryGateways;
  let eventCrawler: BasicEventCrawler;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let timeGateway: CustomTimeGateway;

  beforeEach(async () => {
    const testAppAndDeps = await buildTestApp();
    ({
      inMemoryUow: uow,
      gateways,
      eventCrawler,
      generateConnectedUserJwt,
    } = testAppAndDeps);
    const request = testAppAndDeps.request;
    timeGateway = testAppAndDeps.gateways.timeGateway;
    httpClient = createSupertestSharedClient(establishmentRoutes, request);
    uow.userRepository.users = [backofficeAdminUser, user];
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 204 - Establishment Aggregate deleted with back office JWT`, async () => {
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];

    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {
        authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {},
      status: 204,
    });
    expectToEqual(
      uow.establishmentAggregateRepository.establishmentAggregates,
      [],
    );
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 204 - removes the establishment marketing contact once the EstablishmentDeleted event is processed`, async () => {
    const contactEmail = "marketing-contact@example.com";
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];
    uow.establishmentMarketingRepository.contacts = [
      {
        contactEmail,
        siret: establishmentAggregate.establishment.siret,
        nafCode: null,
        emailContactHistory: [
          {
            createdAt: new Date("2024-01-01"),
            email: contactEmail,
            firstName: "John",
            lastName: "Doe",
          },
        ],
      },
    ];
    gateways.establishmentMarketingGateway.marketingEstablishments = [
      {
        siret: establishmentAggregate.establishment.siret,
        email: contactEmail,
        firstName: "John",
        lastName: "Doe",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false,
      },
    ];

    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {
        authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {},
      status: 204,
    });

    await processEventsForEmailToBeSent(eventCrawler);

    expectToEqual(uow.establishmentMarketingRepository.contacts, []);
    expectToEqual(
      gateways.establishmentMarketingGateway.marketingEstablishments,
      [],
    );
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 400 - Unauthenticated`, async () => {
    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {} as any,
    });

    expectHttpResponseToEqual(response, {
      body: {
        issues: [
          "authorization : Invalid input: expected string, received undefined",
        ],
        message:
          "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: DELETE /form-establishments/:siret",
        status: 400,
      },
      status: 400,
    });
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 401 - Jwt expired`, async () => {
    const now = new Date("2024-01-30T00:00:00Z");
    timeGateway.setNextDate(now);
    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {
        authorization: generateConnectedUserJwt({
          ...backofficeAdminJwtPayload,
          iat: Math.round(now.getTime() / 1000),
          exp: Math.round(subDays(now, 10).getTime() / 1000),
        }),
      },
    });

    expectHttpResponseToEqual(response, {
      body: { message: authExpiredMessage(), status: 401 },
      status: 401,
    });
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 403 - Access refused with establishment admin user JWT`, async () => {
    const now = new Date();
    timeGateway.setNextDate(now);
    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {
        authorization: generateConnectedUserJwt(
          createConnectedUserJwtPayload({
            userId: user.id,
            now: timeGateway.now(),
            durationHours: 2,
          }),
        ),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {
        message: errors.user.forbidden({ userId: user.id }).message,
        status: 403,
      },
      status: 403,
    });
  });

  it(`${displayRouteName(
    establishmentRoutes.deleteEstablishment,
  )} 404 - Establishment Aggregate not found`, async () => {
    const response = await httpClient.deleteEstablishment({
      urlParams: {
        siret: establishmentAggregate.establishment.siret,
      },
      headers: {
        authorization: generateConnectedUserJwt(backofficeAdminJwtPayload),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {
        status: 404,
        message: errors.establishment.notFound({
          siret: establishmentAggregate.establishment.siret,
        }).message,
      },
      status: 404,
    });
  });
});
