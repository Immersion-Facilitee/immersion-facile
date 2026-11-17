import type { EventStatus } from "shared";
import type { DomainEvent } from "../events";

export type DeleteOldestEventsParams = {
  limit: number;
  occuredAt: {
    from?: Date;
    to: Date;
  };
};

export interface OutboxRepository {
  deleteOldestEvents(params: DeleteOldestEventsParams): Promise<number>;
  countAllEvents(params: { status: EventStatus }): Promise<number>;
  save: (event: DomainEvent) => Promise<void>;

  /**
   * USE ONLY FOR NEW EVENTS, it does not handle previous publications
   */
  saveNewEventsBatch: (events: DomainEvent[]) => Promise<void>;
  markEventsAsInProcess: (events: DomainEvent[]) => Promise<void>;
  markOldInProcessEventsAsToRepublish: ({
    eventsBeforeDate,
  }: {
    eventsBeforeDate: Date;
  }) => Promise<void>;
}
