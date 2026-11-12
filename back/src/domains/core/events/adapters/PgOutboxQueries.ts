import { groupBy, isNil, map, prop, reject, values } from "ramda";
import { pipeWithValue } from "shared";
import type { KyselyDb } from "../../../../config/pg/kysely/kyselyUtils";
import type { DomainEvent, EventStatus } from "../events";
import type { OutboxQueries } from "../ports/OutboxQueries";
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

    return convertRowsToDomainEvents(results as StoredEventRow[]);
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

    return convertRowsToDomainEvents(results as StoredEventRow[]);
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
      ])
      .where("was_quarantined", "=", false)
      .orderBy("priority", "asc")
      .orderBy("occurred_at", "asc");
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
