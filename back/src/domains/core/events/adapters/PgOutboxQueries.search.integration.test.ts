import type { Pool } from "pg";
import { ConventionDtoBuilder, expectToEqual } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { CustomTimeGateway } from "../../time-gateway/adapters/CustomTimeGateway";
import { TestUuidGenerator } from "../../uuid-generator/adapters/UuidGeneratorImplementations";
import type { DomainEvent } from "../events";
import { makeCreateNewEvent } from "../ports/EventBus";
import { PgOutboxQueries } from "./PgOutboxQueries";
import { PgOutboxRepository } from "./PgOutboxRepository";

const eventIds = {
  notificationAdded: "00000000-0000-4000-8000-000000000001",
  conventionSubmitted: "00000000-0000-4000-8000-000000000002",
  agencyActivated: "00000000-0000-4000-8000-000000000003",
  establishmentDeleted: "00000000-0000-4000-8000-000000000004",
  conventionBroadcast: "00000000-0000-4000-8000-000000000005",
  conventionFullySigned: "00000000-0000-4000-8000-000000000006",
};

describe("PgOutboxQueries - searchEvents", () => {
  const uuidGenerator = new TestUuidGenerator();
  const createNewEvent = makeCreateNewEvent({
    timeGateway: new CustomTimeGateway(),
    uuidGenerator,
  });

  const convention = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withSiret("11111111111111")
    .build();
  const agencyId = "22222222-2222-4222-8222-222222222222";
  const siret = "33333333333333";

  uuidGenerator.setNextUuids([
    eventIds.notificationAdded,
    eventIds.conventionSubmitted,
    eventIds.agencyActivated,
    eventIds.establishmentDeleted,
    eventIds.conventionBroadcast,
    eventIds.conventionFullySigned,
  ]);

  const notificationAddedEvent = createNewEvent({
    topic: "NotificationAdded",
    payload: { id: "notification-id", kind: "email" },
    occurredAt: "2026-11-01T10:00:00.000Z",
  });
  const conventionSubmittedEvent = createNewEvent({
    topic: "ConventionSubmittedByBeneficiary",
    payload: {
      convention,
      triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
    },
    occurredAt: "2026-11-01T10:01:00.000Z",
  });
  const agencyActivatedEvent = createNewEvent({
    topic: "AgencyActivated",
    payload: { agencyId, triggeredBy: null },
    occurredAt: "2026-11-01T10:02:00.000Z",
  });
  const establishmentDeletedEvent = createNewEvent({
    topic: "EstablishmentDeleted",
    payload: { siret, triggeredBy: null },
    occurredAt: "2026-11-01T10:03:00.000Z",
  });
  const conventionBroadcastEvent = createNewEvent({
    topic: "ConventionBroadcastRequested",
    payload: { conventionId: convention.id, triggeredBy: null },
    occurredAt: "2026-11-01T10:04:00.000Z",
  });
  const conventionFullySignedEvent = createNewEvent({
    topic: "ConventionFullySigned",
    payload: {
      convention,
      triggeredBy: { kind: "convention-magic-link", role: "beneficiary" },
    },
    occurredAt: "2026-11-02T10:00:00.000Z",
    status: "published",
    publications: [
      {
        publishedAt: "2026-11-02T10:00:01.000Z",
        failures: [
          { subscriptionId: "first-subscription", errorMessage: "boom" },
          { subscriptionId: "second-subscription", errorMessage: "bang" },
        ],
      },
      { publishedAt: "2026-11-02T10:05:00.000Z", failures: [] },
    ],
  });

  const events: DomainEvent[] = [
    notificationAddedEvent,
    conventionSubmittedEvent,
    agencyActivatedEvent,
    establishmentDeletedEvent,
    conventionBroadcastEvent,
    conventionFullySignedEvent,
  ];

  let pool: Pool;
  let db: KyselyDb;
  let outboxQueries: PgOutboxQueries;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.deleteFrom("outbox_failures").execute();
    await db.deleteFrom("outbox_publications").execute();
    await db.deleteFrom("outbox").execute();
    outboxQueries = new PgOutboxQueries(db);
    const outboxRepository = new PgOutboxRepository(db);
    for (const event of events) await outboxRepository.save(event);
  });

  it.each<{ path: string; search: string; expectedEventIds: string[] }>([
    {
      path: "id",
      search: "notification-id",
      expectedEventIds: [eventIds.notificationAdded],
    },
    {
      path: "convention.id",
      search: convention.id,
      expectedEventIds: [
        eventIds.conventionFullySigned,
        eventIds.conventionSubmitted,
      ],
    },
    {
      path: "agencyId",
      search: agencyId,
      expectedEventIds: [eventIds.agencyActivated],
    },
    {
      path: "siret",
      search: siret,
      expectedEventIds: [eventIds.establishmentDeleted],
    },
  ])(
    "finds events by payload $path, most recent first",
    async ({ search, expectedEventIds }) => {
      const { data } = await outboxQueries.searchEvents({
        search,
        pagination: { page: 1, perPage: 10 },
      });

      expectToEqual(
        data.map(({ id }) => id),
        expectedEventIds,
      );
    },
  );

  it("returns paginated events with their publications", async () => {
    expectToEqual(
      await outboxQueries.searchEvents({
        search: convention.id,
        pagination: { page: 1, perPage: 1 },
      }),
      {
        data: [conventionFullySignedEvent],
        pagination: {
          currentPage: 1,
          numberPerPage: 1,
          totalPages: 2,
          totalRecords: 2,
        },
      },
    );
  });

  it("returns total records even when requested page is beyond results", async () => {
    expectToEqual(
      await outboxQueries.searchEvents({
        search: agencyId,
        pagination: { page: 3, perPage: 10 },
      }),
      {
        data: [],
        pagination: {
          currentPage: 3,
          numberPerPage: 10,
          totalPages: 1,
          totalRecords: 1,
        },
      },
    );
  });
});
