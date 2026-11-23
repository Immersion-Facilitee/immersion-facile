import { addDays } from "date-fns";
import {
  ConnectedUserBuilder,
  type ConnectedUserJwt,
  currentJwtVersions,
  displayRouteName,
  type EstablishmentRoutes,
  errors,
  establishmentRoutes,
  expectHttpResponseToEqual,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { EstablishmentAggregateBuilder } from "../../../../domains/establishment/helpers/EstablishmentBuilders";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe(`${displayRouteName(establishmentRoutes.getEstablishmentsForAdmin)} to list establishments for backoffice admin`, () => {
  const backofficeAdminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin-user")
    .withIsAdmin(true)
    .buildUser();

  const nonAdminUser = new ConnectedUserBuilder()
    .withId("non-admin-user")
    .withIsAdmin(false)
    .buildUser();

  const bakery = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("11111111111111")
    .withEstablishmentName("BOULANGERIE DU CENTRE")
    .withEstablishmentCustomizedName("Le Fournil")
    .withEstablishmentCreatedAt(new Date("2024-01-10T10:00:00.000Z"))
    .withEstablishmentUpdatedAt(new Date("2026-10-20T10:00:00.000Z"))
    .build();

  const garage = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("22222222222222")
    .withEstablishmentName("GARAGE MARTIN")
    .build();

  let httpClient: HttpClient<EstablishmentRoutes>;
  let inMemoryUow: InMemoryUnitOfWork;
  let backofficeAdminToken: ConnectedUserJwt;
  let nonAdminToken: ConnectedUserJwt;

  beforeEach(async () => {
    const deps = await buildTestApp();
    inMemoryUow = deps.inMemoryUow;
    httpClient = createSupertestSharedClient(establishmentRoutes, deps.request);

    inMemoryUow.userRepository.users = [backofficeAdminUser, nonAdminUser];
    inMemoryUow.establishmentAggregateRepository.establishmentAggregates = [
      bakery,
      garage,
    ];

    backofficeAdminToken = deps.generateConnectedUserJwt({
      userId: backofficeAdminUser.id,
      version: currentJwtVersions.connectedUser,
      iat: Date.now(),
      exp: addDays(new Date(), 5).getTime(),
    });
    nonAdminToken = deps.generateConnectedUserJwt({
      userId: nonAdminUser.id,
      version: currentJwtVersions.connectedUser,
      iat: Date.now(),
      exp: addDays(new Date(), 5).getTime(),
    });
  });

  it("401 - Unauthorized when not correctly authenticated", async () => {
    const response = await httpClient.getEstablishmentsForAdmin({
      headers: { authorization: "invalid-token" },
      queryParams: {},
    });

    expectHttpResponseToEqual(response, {
      status: 401,
      body: { status: 401, message: invalidTokenMessage },
    });
  });

  it("403 - Forbidden when user is not backoffice admin", async () => {
    const response = await httpClient.getEstablishmentsForAdmin({
      headers: { authorization: nonAdminToken },
      queryParams: {},
    });

    expectHttpResponseToEqual(response, {
      status: 403,
      body: {
        status: 403,
        message: errors.user.forbidden({ userId: nonAdminUser.id }).message,
      },
    });
  });

  it("400 - Bad request when the search is too short", async () => {
    const response = await httpClient.getEstablishmentsForAdmin({
      headers: { authorization: backofficeAdminToken },
      queryParams: { search: "bo" },
    });

    expectHttpResponseToEqual(response, {
      status: 400,
      body: {
        issues: ["search : Le minimum est de 3 caractères"],
        message:
          "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /establishments-for-admin",
        status: 400,
      },
    });
  });

  it("200 - returns establishments matching the search", async () => {
    const response = await httpClient.getEstablishmentsForAdmin({
      headers: { authorization: backofficeAdminToken },
      queryParams: { page: 1, perPage: 10, search: "fournil" },
    });

    expectHttpResponseToEqual(response, {
      status: 200,
      body: {
        data: [
          {
            siret: bakery.establishment.siret,
            name: "BOULANGERIE DU CENTRE",
            customizedName: "Le Fournil",
            city: bakery.establishment.locations[0].address.city,
            postcode: bakery.establishment.locations[0].address.postcode,
            otherLocationsCount: 0,
            createdAt: "2024-01-10T10:00:00.000Z",
            updatedAt: "2026-10-20T10:00:00.000Z",
            discussionsCount: 0,
            validatedConventionsCount: 0,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 10,
          totalRecords: 1,
        },
      },
    });
  });
});
