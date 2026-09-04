import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import { agencyIdSchema } from "../agency/agency.schema";
import {
  apiConsumerIdSchema,
  apiConsumerNameSchema,
} from "../apiConsumer/apiConsumer.schema";
import { conventionStatuses } from "../convention/convention.dto";
import { conventionIdSchema } from "../convention/convention.schema";
import { dateTimeIsoStringSchema } from "../utils/date";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  BroadcastFeedback,
  BroadcastFeedbackResponse,
  ConventionBroadcastRequestParams,
  ConventionLastBroadcastFeedbackResponse,
  SubscriberErrorFeedback,
} from "./broadcastFeedback.dto";

const broadcastFeedbackResponseSchema: ZodSchemaWithInputMatchingOutput<BroadcastFeedbackResponse> =
  z
    .object({
      httpStatus: z.number(),
      body: z.unknown().optional(),
    })
    .nullable();

const subscriberErrorFeedbackSchema: ZodSchemaWithInputMatchingOutput<SubscriberErrorFeedback> =
  z.object({
    message: z.string(),
    error: z.unknown().optional(),
  });

const conventionBroadcastRequestParamsSchema: ZodSchemaWithInputMatchingOutput<ConventionBroadcastRequestParams> =
  z.object({
    conventionId: conventionIdSchema,
    callbackUrl: absoluteUrlSchema.optional(),
    conventionStatus: z.enum(conventionStatuses).optional(),
  });

const nonNullableBroadcastFeedbackSchema = z
  .object({
    serviceName: z.string(),
    consumerId: apiConsumerIdSchema.nullable(),
    consumerName: apiConsumerNameSchema,
    conventionId: conventionIdSchema,
    agencyId: agencyIdSchema,
    subscriberErrorFeedback: subscriberErrorFeedbackSchema.optional(),
    requestParams: conventionBroadcastRequestParamsSchema,
    response: broadcastFeedbackResponseSchema.optional(),
    occurredAt: dateTimeIsoStringSchema,
    handledByAgency: z.boolean(),
  })
  .refine(
    ({ conventionId, requestParams }) =>
      conventionId === requestParams.conventionId,
    {
      message: "conventionId must match requestParams.conventionId",
      path: ["requestParams", "conventionId"],
    },
  );

export const broadcastFeedbackSchema: ZodSchemaWithInputMatchingOutput<BroadcastFeedback | null> =
  nonNullableBroadcastFeedbackSchema.nullable();

export const conventionLastBroadcastFeedbackResponseSchema: ZodSchemaWithInputMatchingOutput<ConventionLastBroadcastFeedbackResponse> =
  z.union([
    z
      .object({
        broadcastFeedback: z.null(),
      })
      .strict(),
    z.object({
      broadcastFeedback: nonNullableBroadcastFeedbackSchema,
      shouldBeHandled: z.boolean(),
    }),
  ]);
