import { values } from "ramda";
import type { EventStatus } from "shared";
import { createLogger } from "../../../../utils/logger";
import type { DomainEvent } from "../events";
import type {
  DeleteOldestEventsParams,
  OutboxRepository,
} from "../ports/OutboxRepository";

const logger = createLogger(__filename);

export class InMemoryOutboxRepository implements OutboxRepository {
  constructor(private _events: Record<string, DomainEvent> = {}) {}
  public async deleteOldestEvents({
    limit,
    occuredAt,
  }: DeleteOldestEventsParams): Promise<number> {
    const { deleted, eventsToKeep } = this.events
      .sort((a, b) => (a.occurredAt >= b.occurredAt ? 0 : -1))
      .reduce<{
        eventsToKeep: Record<string, DomainEvent>;
        deleted: number;
      }>(
        ({ deleted, eventsToKeep }, event) => {
          const isDeleted = !(
            deleted === limit ||
            new Date(event.occurredAt) > occuredAt.to ||
            (occuredAt.from && new Date(event.occurredAt) < occuredAt.from)
          );

          return {
            eventsToKeep: {
              ...eventsToKeep,
              ...(isDeleted ? {} : { [event.id]: event }),
            },
            deleted: deleted + (isDeleted ? 1 : 0),
          };
        },
        { eventsToKeep: {}, deleted: 0 },
      );

    this._events = eventsToKeep;
    return deleted;
  }

  public async countAllEvents({
    status,
  }: {
    status: EventStatus;
  }): Promise<number> {
    return this.events.filter((event) => event.status === status).length;
  }

  //test purposes
  public set events(events: DomainEvent[]) {
    this._events = events.reduce<Record<string, DomainEvent>>(
      (acc, value) => ({ ...acc, [value.id]: value }),
      {},
    );
  }
  public get events(): DomainEvent[] {
    return values(this._events);
  }

  public async save(event: DomainEvent): Promise<void> {
    this._events[event.id] = event;
    logger.info({
      events: [event],
      message: "save",
    });
  }

  public async saveNewEventsBatch(events: DomainEvent[]): Promise<void> {
    events.forEach((event) => {
      this._events[event.id] = event;
    });
  }

  public async markEventsAsInProcess(events: DomainEvent[]): Promise<void> {
    events.forEach((event) => {
      this._events[event.id] = {
        ...event,
        status: "in-process",
      };
    });
  }

  public async markOldInProcessEventsAsToRepublish({
    eventsBeforeDate,
  }: {
    eventsBeforeDate: Date;
  }): Promise<void> {
    const oldInProcessEvents = this.events.filter(
      (event) =>
        event.status === "in-process" &&
        new Date(event.occurredAt) < eventsBeforeDate,
    );
    oldInProcessEvents.forEach((event) => {
      this._events[event.id] = {
        ...event,
        status: "to-republish",
      };
    });
  }
}
