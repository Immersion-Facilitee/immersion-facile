import { calculatePaginationResult, type DataWithPagination } from "shared";
import { createLogger } from "../../../../utils/logger";
import type { DomainEvent } from "../events";
import type { OutboxQueries, SearchEventsParams } from "../ports/OutboxQueries";
import type { InMemoryOutboxRepository } from "./InMemoryOutboxRepository";

const logger = createLogger(__filename);

export class InMemoryOutboxQueries implements OutboxQueries {
  constructor(private readonly outboxRepository: InMemoryOutboxRepository) {}

  public async getFailedEvents(): Promise<DomainEvent[]> {
    const allEvents = this.outboxRepository.events;
    logger.debug({
      events: allEvents,
      message: "getAllFailedEvents",
    });

    return allEvents.filter((event) => {
      const lastPublication = event.publications[event.publications.length - 1];
      if (!lastPublication) return false;
      return lastPublication.failures.length > 0;
    });
  }

  public async searchEvents({
    search,
    pagination: { page, perPage },
  }: SearchEventsParams): Promise<DataWithPagination<DomainEvent>> {
    const matchingEvents = this.outboxRepository.events
      .filter((event) =>
        searchablePaths.some(
          (path) => getValueAtPath(event.payload, path) === search,
        ),
      )
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
      );

    return {
      data: matchingEvents.slice((page - 1) * perPage, page * perPage),
      pagination: calculatePaginationResult({
        page,
        perPage,
        totalRecords: matchingEvents.length,
      }),
    };
  }

  public async getEventsToPublish() {
    const allEvents = this.outboxRepository.events;
    logger.debug({
      events: allEvents,
      message: "getAllUnpublishedEvents",
    });

    const unpublishedEvents = allEvents.filter(
      (event) => !event.wasQuarantined && event.publications.length === 0,
    );

    if (unpublishedEvents.length > 0) {
      logger.info({
        events: unpublishedEvents,
        message: "getAllUnpublishedEvents: found unpublished events",
      });
    }
    return unpublishedEvents;
  }
}

const searchablePaths: string[][] = [
  ["id"],
  ["convention", "id"],
  ["agencyId"],
  ["siret"],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getValueAtPath = (payload: unknown, path: string[]): unknown =>
  path.reduce<unknown>(
    (value, key) => (isRecord(value) ? value[key] : undefined),
    payload,
  );
