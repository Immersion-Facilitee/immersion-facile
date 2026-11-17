import type { DataWithPagination, PaginationQueryParams } from "shared";
import type { DomainEvent } from "../events";

export type SearchEventsParams = {
  search: string;
  pagination: Required<PaginationQueryParams>;
};

export interface OutboxQueries {
  getEventsToPublish: (params: { limit: number }) => Promise<DomainEvent[]>;
  getFailedEvents: (params: { limit: number }) => Promise<DomainEvent[]>;
  searchEvents: (
    params: SearchEventsParams,
  ) => Promise<DataWithPagination<DomainEvent>>;
}
