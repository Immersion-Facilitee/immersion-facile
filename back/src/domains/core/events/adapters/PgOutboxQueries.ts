import { sql } from "kysely";
import { groupBy, isNil, map, prop, reject, sortBy, values } from "ramda";
import {
  calculatePaginationResult,
  type DataWithPagination,
  type EventStatus,
  pipeWithValue,
} from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import type { DomainEvent } from "../events";
import type { OutboxQueries, SearchEventsParams } from "../ports/OutboxQueries";
import {
  type StoredEventRow,
  storedEventRowsToDomainEvent,
} from "./PgOutboxRepository";

export class PgOutboxQueries implements OutboxQueries {
  constructor(private transaction: KyselyDb) {}

  public async getFailedEvents(params: {
    limit: number;
  }): Promise<DomainEvent[]> {
    const eventIds = await this.#getEventIdsByStatus({
      statuses: ["failed-but-will-retry"],
      limit: params.limit,
    });

    if (eventIds.length === 0) return [];

    const results = await this.#getEventsQueryBuilder()
      .where("outbox.id", "in", eventIds)
      .execute();

    return convertRowsToDomainEvents(results);
  }

  public async getEventsToPublish(params: {
    limit: number;
  }): Promise<DomainEvent[]> {
    const eventIds = await this.#getEventIdsByStatus({
      statuses: ["never-published", "to-republish"],
      limit: params.limit,
    });

    if (eventIds.length === 0) return [];

    const results = await this.#getEventsQueryBuilder()
      .where("outbox.id", "in", eventIds)
      .execute();

    return convertRowsToDomainEvents(results);
  }

  public async searchEvents({
    search,
    pagination: { page, perPage },
  }: SearchEventsParams): Promise<DataWithPagination<DomainEvent>> {
    const { totalRecords } = await this.#selectEventsRelatedTo(search)
      .select(({ fn }) => fn.countAll().as("totalRecords"))
      .executeTakeFirstOrThrow();

    const pageEventIds = await this.transaction
      .with(
        (cte) => cte("matching_events").materialized(),
        () => this.#selectEventsRelatedTo(search).select(["id", "occurred_at"]),
      )
      .selectFrom("matching_events")
      .select("id")
      .orderBy("occurred_at", "desc")
      .orderBy("id", "desc")
      .limit(perPage)
      .offset((page - 1) * perPage)
      .execute()
      .then((rows) => rows.map(({ id }) => id));

    const pageEvents =
      pageEventIds.length === 0
        ? []
        : await this.#selectEventRowsWithPublications()
            .where("outbox.id", "in", pageEventIds)
            .execute()
            .then((rows) => convertRowsToDomainEvents(rows));

    return {
      data: sortBy(({ id }) => pageEventIds.indexOf(id), pageEvents),
      pagination: calculatePaginationResult({
        page,
        perPage,
        totalRecords: Number(totalRecords),
      }),
    };
  }

  #selectEventsRelatedTo(search: string) {
    return this.transaction
      .selectFrom("outbox")
      .where((eb) =>
        eb.or([
          eb(sql`payload ->> 'id'`, "=", search),
          eb(sql`payload -> 'convention' ->> 'id'`, "=", search),
          eb(sql`payload ->> 'agencyId'`, "=", search),
          eb(sql`payload ->> 'siret'`, "=", search),
        ]),
      );
  }

  async #getEventIdsByStatus(params: {
    statuses: EventStatus[];
    limit: number;
  }): Promise<string[]> {
    if (params.statuses.length === 0) return [];

    const query = this.transaction
      .selectFrom("outbox")
      .select("id")
      .where("was_quarantined", "=", false)
      .orderBy("priority", "asc")
      .orderBy("occurred_at", "asc")
      .limit(params.limit);

    const results = await query
      .where("status", "in", params.statuses)
      .execute();
    return results.map((e) => e.id);
  }

  #getEventsQueryBuilder() {
    return this.#selectEventRowsWithPublications()
      .where("was_quarantined", "=", false)
      .orderBy("priority", "asc")
      .orderBy("occurred_at", "asc");
  }

  #selectEventRowsWithPublications() {
    return this.transaction
      .selectFrom("outbox")
      .leftJoin(
        "outbox_publications",
        "outbox.id",
        "outbox_publications.event_id",
      )
      .leftJoin(
        "outbox_failures",
        "outbox_publications.id",
        "outbox_failures.publication_id",
      )
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
      ]);
  }
}

const convertRowsToDomainEvents = (rows: StoredEventRow[]): DomainEvent[] =>
  pipeWithValue(
    rows,
    groupBy(prop("id")),
    values,
    reject(isNil),
    map(storedEventRowsToDomainEvent),
  );
