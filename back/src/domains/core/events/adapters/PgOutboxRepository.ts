import { differenceWith, propEq, splitEvery } from "ramda";
import {
  type DateString,
  errors,
  pipeWithValue,
  replaceArrayElement,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import { createLogger } from "../../../../utils/logger";
import type {
  DomainEvent,
  DomainTopic,
  EventFailure,
  EventPriority,
  EventPublication,
  EventStatus,
} from "../events";
import { defaultPriority } from "../ports/EventBus";
import type {
  DeleteOldestEventsParams,
  OutboxRepository,
} from "../ports/OutboxRepository";

const saveNewEventsBatchChunkSize = 500;

export type StoredEventRow = {
  id: string;
  topic: DomainTopic;
  payload: any;
  occurred_at: Date;
  was_quarantined: boolean;
  published_at: Date | null;
  subscription_id: string | null;
  error_message: string | null;
  status: EventStatus;
  priority: number | null;
};

const logger = createLogger(__filename);

export class PgOutboxRepository implements OutboxRepository {
  constructor(private transaction: KyselyDb) {}
  async deleteOldestEvents({
    limit,
    occuredAt,
  }: DeleteOldestEventsParams): Promise<number> {
    if (occuredAt.from && occuredAt.to < occuredAt.from)
      throw errors.event.deleteWithBadOccuredAtRange({
        from: occuredAt.from,
        to: occuredAt.to,
      });

    return this.transaction
      .with("to_delete", (qb) =>
        pipeWithValue(
          qb
            .selectFrom("outbox")
            .select("id")
            .where("occurred_at", "<=", occuredAt.to)
            .orderBy("occurred_at", "asc")
            .limit(limit),
          (qb) =>
            occuredAt.from ? qb.where("occurred_at", ">=", occuredAt.from) : qb,
        ),
      )
      .with("deleted_publications_failures", (qb) =>
        qb
          .deleteFrom("outbox_failures")
          .using(["to_delete", "outbox_publications"])
          .whereRef(
            "outbox_failures.publication_id",
            "=",
            "outbox_publications.id",
          )
          .whereRef("outbox_publications.event_id", "=", "to_delete.id"),
      )
      .with("deleted_publications", (qb) =>
        qb
          .deleteFrom("outbox_publications")
          .using("to_delete")
          .whereRef("outbox_publications.event_id", "=", "to_delete.id"),
      )
      .with("deleted_events", (qb) =>
        qb
          .deleteFrom("outbox")
          .using("to_delete")
          .whereRef("outbox.id", "=", "to_delete.id")
          .returning("outbox.id"),
      )
      .selectFrom("deleted_events")
      .select(({ fn }) => fn.count("deleted_events.id").as("deleted_events"))
      .executeTakeFirst()
      .then((result) => (result ? Number(result.deleted_events) : 0));
  }

  public async countAllEvents({
    status,
  }: {
    status: EventStatus;
  }): Promise<number> {
    const result = (await this.transaction
      .selectFrom("outbox")
      .select((eb) => eb.fn.countAll().as("total"))
      .where("status", "=", status)
      .executeTakeFirst()) as { total: string };

    return Number.parseInt(result.total);
  }

  public async markEventsAsInProcess(events: DomainEvent[]): Promise<void> {
    if (events.length)
      await this.transaction
        .updateTable("outbox")
        .set({
          status: "in-process",
        })
        .where(
          "id",
          "in",
          events.map(({ id }) => id),
        )
        .execute();
  }

  public async markOldInProcessEventsAsToRepublish({
    eventsBeforeDate,
  }: {
    eventsBeforeDate: Date;
  }): Promise<void> {
    await this.transaction
      .updateTable("outbox")
      .set({ status: "to-republish" })
      .where("status", "=", "in-process")
      .where("was_quarantined", "=", false)
      .where("occurred_at", "<", eventsBeforeDate)
      .execute();
  }

  public async saveNewEventsBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    for (const eventsChunk of splitEvery(saveNewEventsBatchChunkSize, events)) {
      await this.transaction
        .insertInto("outbox")
        .values(
          eventsChunk.map((event) => ({
            id: event.id,
            occurred_at: event.occurredAt,
            was_quarantined: event.wasQuarantined,
            topic: event.topic,
            payload: JSON.stringify(event.payload),
            status: event.status,
            priority: event.priority,
          })),
        )
        .execute();
    }
  }

  public async save(event: DomainEvent): Promise<void> {
    const eventInDb =
      await this.#storeEventInOutboxOrRecoverItIfAlreadyThere(event);

    const newPublications = differenceWith(
      (dbEvent, newEvent) => dbEvent.publishedAt === newEvent.publishedAt,
      event.publications,
      eventInDb.publications,
    );

    for (const publication of newPublications) {
      await this.#saveNewPublication(event.id, publication);
    }

    if (event.publications.length === 0) {
      logger.info({
        topic: event.topic,
        events: [event],
        message: "eventsSavedBeforePublish",
      });
    }
  }

  async #storeEventInOutboxOrRecoverItIfAlreadyThere(
    event: DomainEvent,
  ): Promise<DomainEvent> {
    const { id, occurredAt, wasQuarantined, topic, payload, status, priority } =
      event;

    const eventAlreadyInDb = await this.#getEventById(event.id);
    if (eventAlreadyInDb) {
      await this.transaction
        .updateTable("outbox")
        .set({
          was_quarantined: wasQuarantined,
          status,
        })
        .where("id", "=", id)
        .execute();
      return { ...eventAlreadyInDb, wasQuarantined: event.wasQuarantined };
    }

    const builder = this.transaction.insertInto("outbox").values({
      id,
      occurred_at: occurredAt,
      was_quarantined: wasQuarantined,
      topic,
      payload: JSON.stringify(payload),
      status,
      priority,
    });

    await builder.execute();

    return { ...event, publications: [] }; // publications will be added after in process
  }

  async #saveNewPublication(
    eventId: string,
    { publishedAt, failures }: EventPublication,
  ) {
    const results = await this.transaction
      .insertInto("outbox_publications")
      .values({ event_id: eventId, published_at: publishedAt })
      .returning("id")
      .execute();

    const publicationId = results.at(0)?.id;

    if (!publicationId) throw errors.event.saveNewPublicationFailed(eventId);

    if (failures.length === 0) return;

    await this.transaction
      .insertInto("outbox_failures")
      .values(
        failures.map(({ subscriptionId, errorMessage }) => ({
          publication_id: publicationId,
          subscription_id: subscriptionId,
          error_message: errorMessage,
        })),
      )
      .execute();
  }

  async #getEventById(id: string): Promise<DomainEvent | undefined> {
    const results = await this.transaction
      .selectFrom("outbox")
      .leftJoin("outbox_publications", "outbox.id", "event_id")
      .leftJoin("outbox_failures", "outbox_publications.id", "publication_id")
      .select([
        "outbox.id as id",
        "occurred_at",
        "was_quarantined",
        "topic",
        "payload",
        "status",
        "outbox_publications.id as publication_id",
        "published_at",
        "subscription_id",
        "error_message",
        "priority",
      ])
      .where("outbox.id", "=", id)
      .orderBy("published_at", "asc")
      .execute();

    return !results.length
      ? undefined
      : storedEventRowsToDomainEvent(results as StoredEventRow[]);
  }
}

export const storedEventRowsToDomainEvent = (
  eventRowsForEvent: StoredEventRow[],
): DomainEvent => {
  const event = eventRowsForEvent.reduce(
    (acc, row): DomainEvent => {
      if (!row.published_at) {
        return {
          ...storedEventOutboxToDomainEvent(row),
          publications: [...acc.publications],
        };
      }

      const publishedAt: DateString = row.published_at.toISOString();

      const existingPublicationIndex = acc.publications.findIndex(
        propEq(publishedAt, "publishedAt"),
      );

      const existingPublication: EventPublication | undefined =
        acc.publications[existingPublicationIndex];
      if (!existingPublication) {
        const failures: EventFailure[] = row.subscription_id
          ? [
              {
                subscriptionId: row.subscription_id,
                errorMessage: row.error_message ?? "",
              },
            ]
          : [];

        return {
          ...storedEventOutboxToDomainEvent(row),
          publications: [...acc.publications, { publishedAt, failures }],
        };
      }

      const failures: EventFailure[] = [
        ...existingPublication.failures,
        ...(row.subscription_id
          ? [
              {
                subscriptionId: row.subscription_id,
                errorMessage: row.error_message ?? "",
              },
            ]
          : []),
      ];

      // reorder failures by subscriptionId
      failures.sort((a, b) => a.subscriptionId.localeCompare(b.subscriptionId));

      const updatedPublication: EventPublication = {
        ...existingPublication,
        failures,
      };

      return {
        ...storedEventOutboxToDomainEvent(row),
        publications: replaceArrayElement(
          acc.publications,
          existingPublicationIndex,
          updatedPublication,
        ),
      };
    },
    { publications: [] } as unknown as DomainEvent,
  );

  event.publications.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  return event;
};

const storedEventOutboxToDomainEvent = (row: StoredEventRow): DomainEvent => ({
  id: row.id,
  topic: row.topic as any, //this is to avoid the error due to : https://github.com/microsoft/TypeScript/issues/42518
  occurredAt: row.occurred_at.toISOString(),
  payload: row.payload,
  wasQuarantined: row.was_quarantined,
  publications: [],
  status: row.status,
  priority: (row.priority ?? defaultPriority) as EventPriority,
});
