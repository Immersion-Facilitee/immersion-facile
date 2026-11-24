import { addDays } from "date-fns";
import {
  type AdminRoutes,
  adminRoutes,
  ConnectedUserBuilder,
  type ConnectedUserJwt,
  type ConnectedUserJwtPayload,
  currentJwtVersions,
  defaultPerPageInWebPagination,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { makeCreateNewEvent } from "../../../../domains/core/events/ports/EventBus";
import { CustomTimeGateway } from "../../../../domains/core/time-gateway/adapters/CustomTimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { TestUuidGenerator } from "../../../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe(`${displayRouteName(adminRoutes.getEventsForAdmin)}`, () => {
  const adminUser = new ConnectedUserBuilder()
    .withId("backoffice-admin-user")
    .withIsAdmin(true)
    .buildUser();
  const nonAdminUser = new ConnectedUserBuilder()
    .withId("non-admin-user")
    .withIsAdmin(false)
    .buildUser();

  const agencyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const agencyActivatedEvent = makeCreateNewEvent({
    timeGateway: new CustomTimeGateway(),
    uuidGenerator: new TestUuidGenerator(["agency-activated-event-id"]),
  })({
    topic: "AgencyActivated",
    payload: {
      agencyId,
      triggeredBy: { kind: "connected-user", userId: adminUser.id },
    },
    occurredAt: "2026-11-02T10:00:00.000Z",
  });

  let adminToken: ConnectedUserJwt;
  let nonAdminToken: ConnectedUserJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let httpClient: HttpClient<AdminRoutes>;

  const makeJwtPayload = (userId: string): ConnectedUserJwtPayload => ({
    version: currentJwtVersions.connectedUser,
    iat: Date.now(),
    exp: addDays(new Date(), 30).getTime(),
    userId,
  });

  beforeEach(async () => {
    const testApp = await buildTestApp();
    ({ inMemoryUow } = testApp);
    inMemoryUow.userRepository.users = [adminUser, nonAdminUser];
    inMemoryUow.outboxRepository.events = [agencyActivatedEvent];
    adminToken = testApp.generateConnectedUserJwt(makeJwtPayload(adminUser.id));
    nonAdminToken = testApp.generateConnectedUserJwt(
      makeJwtPayload(nonAdminUser.id),
    );
    httpClient = createSupertestSharedClient(adminRoutes, testApp.request);
  });

  it("403 - non-admin user cannot search events", async () => {
    const response = await httpClient.getEventsForAdmin({
      headers: { authorization: nonAdminToken },
      queryParams: { search: adminUser.id },
    });

    expectHttpResponseToEqual(response, {
      status: 403,
      body: {
        status: 403,
        message: errors.user.forbidden({ userId: nonAdminUser.id }).message,
      },
    });
  });

  it("200 - returns events of the searched agency", async () => {
    const response = await httpClient.getEventsForAdmin({
      headers: { authorization: adminToken },
      queryParams: { search: agencyId },
    });

    expectHttpResponseToEqual(response, {
      status: 200,
      body: {
        data: [
          {
            id: "agency-activated-event-id",
            occurredAt: "2026-11-02T10:00:00.000Z",
            topic: "AgencyActivated",
            status: "never-published",
            wasQuarantined: false,
            triggeredBy: {
              kind: "connected-user",
              userId: adminUser.id,
              email: adminUser.email,
            },
            payload: agencyActivatedEvent.payload,
            publications: [],
          },
        ],
        pagination: {
          currentPage: 1,
          numberPerPage: defaultPerPageInWebPagination,
          totalPages: 1,
          totalRecords: 1,
        },
      },
    });
  });
});
