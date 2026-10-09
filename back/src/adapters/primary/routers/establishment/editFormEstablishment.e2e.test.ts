import { addDays, millisecondsToSeconds, subYears } from "date-fns";
import {
  authExpiredMessage,
  ConnectedUserBuilder,
  type ConnectedUserJwtPayload,
  currentJwtVersions,
  defaultCountryCode,
  type EstablishmentRoutes,
  errors,
  establishmentRoutes,
  expectArraysToMatch,
  expectHttpResponseToEqual,
  expectToEqual,
  type FormEstablishmentDto,
  FormEstablishmentDtoBuilder,
  updatedAddress1,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type supertest from "supertest";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import {
  type GenerateConnectedUserJwt,
  makeGenerateJwtES256,
} from "../../../../domains/core/jwt";
import {
  TEST_OPEN_ESTABLISHMENT_1,
  TEST_OPEN_ESTABLISHMENT_2,
} from "../../../../domains/core/sirene/adapters/InMemorySiretGateway";
import type { TimeGateway } from "../../../../domains/core/time-gateway/ports/TimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { EstablishmentAggregate } from "../../../../domains/establishment/entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { createConnectedUserJwtPayload } from "../../../../utils/jwt";

describe("Edit form establishments", () => {
  let httpClient: HttpClient<EstablishmentRoutes>;
  let appConfig: AppConfig;
  let gateways: InMemoryGateways;
  let inMemoryUow: InMemoryUnitOfWork;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;

  const formEstablishment = FormEstablishmentDtoBuilder.valid()
    .withSiret(TEST_OPEN_ESTABLISHMENT_1.siret)
    .build();

  const establishmentAdminUser = new ConnectedUserBuilder()
    .withId("admin")
    .withEmail("admin@establishment.mail")
    .buildUser();

  const existingEstablishment = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret(formEstablishment.siret)
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "Boss",
        phone: "+33688774455",
        userId: establishmentAdminUser.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
    ])
    .build();

  beforeEach(async () => {
    let request: supertest.SuperTest<supertest.Test>;
    ({ request, appConfig, gateways, inMemoryUow, generateConnectedUserJwt } =
      await buildTestApp(new AppConfigBuilder().build()));
    httpClient = createSupertestSharedClient(establishmentRoutes, request);

    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      existingEstablishment,
    ];

    gateways.addressApi.setNextLookupStreetAndAddresses([
      [
        {
          address: {
            ...updatedAddress1.addressAndPosition.address,
            countryCode: defaultCountryCode,
          },
          position: updatedAddress1.addressAndPosition.position,
          formattedAddress: "Fake address",
        },
      ],
    ]);
    gateways.timeGateway.defaultDate = new Date();

    inMemoryUow.userRepository.users = [establishmentAdminUser];
  });

  it("200 - Supports posting already existing form establisment when authenticated with establishment JWT", async () => {
    const response = await httpClient.updateFormEstablishment({
      body: formEstablishment,
      headers: {
        authorization: generateConnectedUserJwt(
          createConnectedUserJwtPayload({
            now: gateways.timeGateway.now(),
            durationHours: 30,
            userId: establishmentAdminUser.id,
          }),
        ),
      },
    });

    expectHttpResponseToEqual(response, {
      body: "",
      status: 200,
    });

    expectEstablishmentInRepoUpdated(
      inMemoryUow,
      gateways.timeGateway,
      existingEstablishment,
      formEstablishment,
    );
  });

  it("200 - Updates establishment with new data", async () => {
    const updatedFormEstablishment: FormEstablishmentDto = {
      ...formEstablishment,
      maxContactsPerMonth: 20,
      searchableBy: {
        jobSeekers: false,
        students: true,
      },
      offers: [
        {
          romeCode: "D1103",
          appellationCode: "33333",
          romeLabel: "Boucherie",
          appellationLabel: "Boucher / Bouchère",
          remoteWorkMode: "ON_SITE",
        },
      ],
    };

    expectHttpResponseToEqual(
      await httpClient.updateFormEstablishment({
        body: updatedFormEstablishment,
        headers: {
          authorization: generateConnectedUserJwt(
            createConnectedUserJwtPayload({
              now: gateways.timeGateway.now(),
              durationHours: 30,
              userId: establishmentAdminUser.id,
            }),
          ),
        },
      }),
      {
        body: "",
        status: 200,
      },
    );
    expect(inMemoryUow.outboxRepository.events).toHaveLength(4);

    expectEstablishmentInRepoUpdated(
      inMemoryUow,
      gateways.timeGateway,
      existingEstablishment,
      updatedFormEstablishment,
    );
  });

  it("200 - Supports posting already existing form establisment when authenticated with backoffice JWT", async () => {
    const backofficeAdminUser = new ConnectedUserBuilder()
      .withId("backoffice-admin-user")
      .withIsAdmin(true)
      .buildUser();

    const backofficeAdminICJwtPayload: ConnectedUserJwtPayload = {
      version: currentJwtVersions.connectedUser,
      iat: millisecondsToSeconds(Date.now()),
      exp: millisecondsToSeconds(addDays(new Date(), 30).getTime()),
      userId: backofficeAdminUser.id,
    };

    const contactUsers = formEstablishment.userRights.map((right, index) =>
      new ConnectedUserBuilder()
        .withId(`contact-${index}`)
        .withEmail(right.email)
        .buildUser(),
    );

    inMemoryUow.userRepository.users = [
      establishmentAdminUser,
      ...contactUsers,
      backofficeAdminUser,
    ];

    expectHttpResponseToEqual(
      await httpClient.updateFormEstablishment({
        body: formEstablishment,
        headers: {
          authorization: generateConnectedUserJwt(backofficeAdminICJwtPayload),
        },
      }),
      {
        body: "",
        status: 200,
      },
    );
    expect(inMemoryUow.outboxRepository.events).toHaveLength(4);
    expectEstablishmentInRepoUpdated(
      inMemoryUow,
      gateways.timeGateway,
      existingEstablishment,
      formEstablishment,
    );
  });

  it("400 - not authenticated", async () => {
    const response = await httpClient.updateFormEstablishment({
      body: formEstablishment,
      headers: {} as any,
    });

    expectHttpResponseToEqual(response, {
      body: {
        issues: [
          "authorization : Invalid input: expected string, received undefined",
        ],
        message:
          "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: PUT /form-establishments",
        status: 400,
      },
      status: 400,
    });
  });

  it("401 - Jwt is generated from wrong private key", async () => {
    const generateJwtWithWrongKey = makeGenerateJwtES256<"connectedUser">(
      appConfig.apiJwtPrivateKey, // Private Key is the wrong one !
      undefined,
    );

    const response = await httpClient.updateFormEstablishment({
      body: formEstablishment,
      headers: {
        authorization: generateJwtWithWrongKey(
          createConnectedUserJwtPayload({
            now: gateways.timeGateway.now(),
            durationHours: 30,
            userId: establishmentAdminUser.id,
          }),
        ),
      },
    });

    expectHttpResponseToEqual(response, {
      status: 401,
      body: { status: 401, message: invalidTokenMessage },
    });
  });

  it("401 - Jwt is malformed", async () => {
    const response = await httpClient.updateFormEstablishment({
      body: formEstablishment,
      headers: {
        authorization: "bad-jwt",
      },
    });

    expectHttpResponseToEqual(response, {
      body: { status: 401, message: invalidTokenMessage },
      status: 401,
    });
  });

  it("403 - Jwt is expired", async () => {
    const response = await httpClient.updateFormEstablishment({
      body: formEstablishment,
      headers: {
        authorization: generateConnectedUserJwt(
          createConnectedUserJwtPayload({
            userId: establishmentAdminUser.id,
            now: subYears(gateways.timeGateway.now(), 1),
            durationHours: 30,
          }),
        ),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {
        message: authExpiredMessage(),
        status: 401,
      },
      status: 401,
    });
  });

  it("404 - Missing establishment aggregate", async () => {
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [];

    const establishment = FormEstablishmentDtoBuilder.valid()
      .withSiret(TEST_OPEN_ESTABLISHMENT_2.siret)
      .build();
    const response = await httpClient.updateFormEstablishment({
      body: establishment,
      headers: {
        authorization: generateConnectedUserJwt(
          createConnectedUserJwtPayload({
            now: gateways.timeGateway.now(),
            durationHours: 30,
            userId: establishmentAdminUser.id,
          }),
        ),
      },
    });

    expectHttpResponseToEqual(response, {
      body: {
        status: 404,
        message: errors.establishment.notFound({
          siret: establishment.siret,
        }).message,
      },
      status: 404,
    });
  });
});

function expectEstablishmentInRepoUpdated(
  inMemoryUow: InMemoryUnitOfWork,
  timeGateway: TimeGateway,
  existingEstablishment: EstablishmentAggregate,
  formEstablishment: FormEstablishmentDto,
) {
  expect(inMemoryUow.outboxRepository.events).toHaveLength(4);

  expect(
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates,
  ).toHaveLength(1);
  const updatedAggregateInRepo =
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates[0];
  const { locations, ...restOfEstablishmentInRepo } =
    updatedAggregateInRepo.establishment;

  expectArraysToMatch(locations, [updatedAddress1.addressAndPosition]);
  const { locations: _, ...restOfExistingEstablishment } =
    existingEstablishment.establishment;
  expectToEqual(restOfEstablishmentInRepo, {
    ...restOfExistingEstablishment,
    updatedAt: timeGateway.now(),
    website: formEstablishment.website,
    name: formEstablishment.businessName,
    customizedName: formEstablishment.businessNameCustomized,
    maxContactsPerMonth: formEstablishment.maxContactsPerMonth,
    searchableBy: formEstablishment.searchableBy,
  });
  expectToEqual(
    updatedAggregateInRepo.offers,
    formEstablishment.offers.map((offer) => ({
      ...offer,
      createdAt: timeGateway.now(),
    })),
  );

  expectArraysToMatch(
    updatedAggregateInRepo.userRights,
    formEstablishment.userRights.map((right) => {
      const user = inMemoryUow.userRepository.users.find(
        (user) => user.email === right.email,
      );
      if (!user) throw errors.user.notFoundByEmail({ email: right.email });
      return {
        role: right.role,
        userId: user.id,
        ...(right.job !== undefined && { job: right.job }),
        ...(right.phone !== undefined && { phone: right.phone }),
      };
    }),
  );
}
