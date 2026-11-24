import { z } from "zod";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import { roleSchema } from "../role/role.schema";
import { userIdSchema } from "../user/user.schema";
import { dateTimeIsoStringSchema } from "../utils/date";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type AdminEventListItemDto,
  type AdminEventPublicationDto,
  type AdminEventTriggeredBy,
  type EventStatus,
  eventStatuses,
  type GetEventsForAdminParams,
  type TriggeredBy,
  type WithTriggeredBy,
} from "./event.dto";

export const eventStatusSchema: ZodSchemaWithInputMatchingOutput<EventStatus> =
  z.enum(eventStatuses, { error: localization.invalidEnum });

export const triggeredBySchema: ZodSchemaWithInputMatchingOutput<TriggeredBy> =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("connected-user"), userId: userIdSchema }),
    z.object({ kind: z.literal("convention-magic-link"), role: roleSchema }),
    z.object({ kind: z.literal("crawler") }),
  ]);

export const withTriggeredBySchema: ZodSchemaWithInputMatchingOutput<WithTriggeredBy> =
  z.object({
    triggeredBy: triggeredBySchema,
  });

const adminEventTriggeredBySchema: ZodSchemaWithInputMatchingOutput<AdminEventTriggeredBy> =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("connected-user"),
      userId: userIdSchema,
      email: z.string().nullable(),
    }),
    z.object({ kind: z.literal("convention-magic-link"), role: roleSchema }),
    z.object({ kind: z.literal("crawler") }),
  ]);

const adminEventPublicationSchema: ZodSchemaWithInputMatchingOutput<AdminEventPublicationDto> =
  z.object({
    publishedAt: dateTimeIsoStringSchema,
    failures: z.array(
      z.object({
        subscriptionId: z.string(),
        errorMessage: z.string(),
      }),
    ),
  });

const adminEventListItemSchema: ZodSchemaWithInputMatchingOutput<AdminEventListItemDto> =
  z.object({
    id: z.string(),
    occurredAt: dateTimeIsoStringSchema,
    topic: z.string(),
    status: eventStatusSchema,
    wasQuarantined: z.boolean(),
    triggeredBy: adminEventTriggeredBySchema.nullable(),
    payload: z.unknown(),
    publications: z.array(adminEventPublicationSchema),
  });

export const paginatedAdminEventListSchema: ZodSchemaWithInputMatchingOutput<
  DataWithPagination<AdminEventListItemDto>
> = createPaginatedSchema(adminEventListItemSchema);

export const getEventsForAdminParamsSchema: ZodSchemaWithInputMatchingOutput<GetEventsForAdminParams> =
  paginationQueryParamsSchema.and(
    z.object({
      search: z.string().trim().min(1, localization.required),
    }),
  );
