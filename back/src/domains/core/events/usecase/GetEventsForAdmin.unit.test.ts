import {
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  defaultPerPageInWebPagination,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { CustomTimeGateway } from "../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../uuid-generator/adapters/UuidGeneratorImplementations";
import { makeCreateNewEvent } from "../ports/EventBus";
import {
  type GetEventsForAdmin,
  makeGetEventsForAdmin,
} from "./GetEventsForAdmin";

describe("GetEventsForAdmin", () => {
  const admin = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();
  const notAdmin = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const convention = new ConventionDtoBuilder()
    .withId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    .build();
  const agencyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const siret = "12345678901234";

  const uuidGenerator = new TestUuidGenerator();
  const createNewEvent = makeCreateNewEvent({
    timeGateway: new CustomTimeGateway(),
    uuidGenerator,
  });

  uuidGenerator.setNextUuid("signed-event-id");
  const conventionSignedEvent = createNewEvent({
    topic: "ConventionPartiallySigned",
    payload: {
      convention,
      triggeredBy: { kind: "connected-user", userId: admin.id },
    },
    occurredAt: "2026-11-02T10:00:00.000Z",
    status: "failed-but-will-retry",
    publications: [
      {
        publishedAt: "2026-11-02T10:00:01.000Z",
        failures: [
          {
            subscriptionId: "NotifySignatories",
            errorMessage: "Brevo is down",
          },
        ],
      },
    ],
  });

  uuidGenerator.setNextUuid("agency-activated-event-id");
  const agencyActivatedEvent = createNewEvent({
    topic: "AgencyActivated",
    payload: { agencyId, triggeredBy: { kind: "crawler" } },
    occurredAt: "2026-11-03T10:00:00.000Z",
  });

  uuidGenerator.setNextUuid("establishment-deleted-event-id");
  const establishmentDeletedEvent = createNewEvent({
    topic: "EstablishmentDeleted",
    payload: { siret, triggeredBy: null },
    occurredAt: "2026-11-01T10:00:00.000Z",
  });

  let getEventsForAdmin: GetEventsForAdmin;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getEventsForAdmin = makeGetEventsForAdmin({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.outboxRepository.events = [
      conventionSignedEvent,
      agencyActivatedEvent,
      establishmentDeletedEvent,
    ];
  });

  it("throws forbidden when current user is not backoffice admin", async () => {
    await expectPromiseToFailWithError(
      getEventsForAdmin.execute({ search: convention.id }, notAdmin),
      errors.user.forbidden({ userId: notAdmin.id }),
    );
  });

  it("returns events of the searched convention with their publications and author", async () => {
    const result = await getEventsForAdmin.execute(
      { search: convention.id },
      admin,
    );

    expectToEqual(result, {
      data: [
        {
          id: "signed-event-id",
          occurredAt: "2026-11-02T10:00:00.000Z",
          topic: "ConventionPartiallySigned",
          status: "failed-but-will-retry",
          wasQuarantined: false,
          triggeredBy: { kind: "connected-user", userId: admin.id },
          payload: conventionSignedEvent.payload,
          publications: conventionSignedEvent.publications,
        },
      ],
      pagination: {
        currentPage: 1,
        numberPerPage: defaultPerPageInWebPagination,
        totalPages: 1,
        totalRecords: 1,
      },
    });
  });

  it.each<{ searchedBy: string; search: string; expectedEventIds: string[] }>([
    {
      searchedBy: "agency id",
      search: agencyId,
      expectedEventIds: ["agency-activated-event-id"],
    },
    {
      searchedBy: "siret",
      search: siret,
      expectedEventIds: ["establishment-deleted-event-id"],
    },
    {
      searchedBy: "unknown id",
      search: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expectedEventIds: [],
    },
  ])("searches events by $searchedBy", async ({ search, expectedEventIds }) => {
    const result = await getEventsForAdmin.execute({ search }, admin);

    expectToEqual(
      result.data.map(({ id }) => id),
      expectedEventIds,
    );
  });
});
