import type { Email } from "../email/email.dto";
import type { PaginationQueryParams } from "../pagination/pagination.dto";
import type { Role } from "../role/role.dto";
import type { UserId } from "../user/user.dto";
import type { DateString } from "../utils/date";

export const eventStatuses = [
  "never-published",
  "to-republish",
  "in-process",
  "published",
  "failed-but-will-retry",
  "failed-to-many-times",
] as const;

export type EventStatus = (typeof eventStatuses)[number];

export type TriggeredBy =
  | { kind: "connected-user"; userId: UserId }
  | { kind: "convention-magic-link"; role: Role }
  | { kind: "crawler" };

export type WithTriggeredBy = {
  triggeredBy: TriggeredBy | null;
};

export type AdminEventTriggeredBy =
  | Exclude<TriggeredBy, { kind: "connected-user" }>
  | { kind: "connected-user"; userId: UserId; email: Email | null };

export type GetEventsForAdminParams = PaginationQueryParams & {
  search: string;
};

export type AdminEventFailureDto = {
  subscriptionId: string;
  errorMessage: string;
};

export type AdminEventPublicationDto = {
  publishedAt: DateString;
  failures: AdminEventFailureDto[];
};

export type AdminEventListItemDto = {
  id: string;
  occurredAt: DateString;
  topic: string;
  status: EventStatus;
  wasQuarantined: boolean;
  triggeredBy: AdminEventTriggeredBy | null;
  payload: unknown;
  publications: AdminEventPublicationDto[];
};
