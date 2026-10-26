import { z } from "zod";
import { callbackUrlSchema } from "../AbsoluteUrl";
import { agencyIdSchema, agencyKindSchema } from "../agency/agency.schema";
import { emailSchema } from "../email/email.schema";
import { phoneNumberSchema } from "../phone/phone.schema";
import type { ApiConsumerJwt } from "../tokens/jwt.dto";
import { dateTimeIsoStringSchema, makeDateStringSchema } from "../utils/date";
import {
  stringWithMaxLength255,
  zStringMinLength1Max255,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type ApiConsumer,
  type ApiConsumerContact,
  type ApiConsumerName,
  type ApiConsumerSubscriptionId,
  apiConsumerKinds,
  authorizedCallbackHeaderKeys,
  type CallbackHeaders,
  type CreateWebhookSubscription,
  type WebhookSubscription,
  type WriteApiConsumerParams,
  type WriteApiConsumerRights,
} from "./ApiConsumer";

const apiConsumerContactSchema: ZodSchemaWithInputMatchingOutput<ApiConsumerContact> =
  z.object({
    lastName: zStringMinLength1Max1024,
    firstName: zStringMinLength1Max1024,
    job: zStringMinLength1Max1024,
    phone: phoneNumberSchema,
    emails: z.array(emailSchema),
  });

export const apiConsumerJwtSchema: ZodSchemaWithInputMatchingOutput<ApiConsumerJwt> =
  z.string();

const callbackHeadersSchema: ZodSchemaWithInputMatchingOutput<CallbackHeaders> =
  z.partialRecord(
    z.enum(authorizedCallbackHeaderKeys, {
      error: localization.invalidEnum,
    }),
    zStringMinLength1Max1024,
  );

export const createWebhookSubscriptionSchema: ZodSchemaWithInputMatchingOutput<CreateWebhookSubscription> =
  z.object({
    subscribedEvent: z.enum(["convention.updated"], {
      error: localization.invalidEnum,
    }),
    callbackUrl: callbackUrlSchema,
    callbackHeaders: callbackHeadersSchema,
  });

export const webhookSubscriptionSchema: ZodSchemaWithInputMatchingOutput<WebhookSubscription> =
  createWebhookSubscriptionSchema.and(
    z.object({
      id: z.string(),
      createdAt: dateTimeIsoStringSchema,
    }),
  );

const noScopeRightSchema = z.object({
  kinds: z.array(
    z.enum(apiConsumerKinds, {
      error: localization.invalidEnum,
    }),
  ),
  scope: z.literal("no-scope"),
});

const withNoSubscriptionSchema = z.object({
  subscriptions: z.array(z.never()),
});

const createSearchEstablishmentRightSchema = noScopeRightSchema.and(
  z.object({
    subscriptions: z.array(createWebhookSubscriptionSchema),
  }),
);

const statisticsRightSchema = noScopeRightSchema.and(withNoSubscriptionSchema);

const searchEstablishmentRightSchema = noScopeRightSchema.and(
  z.object({ subscriptions: z.array(webhookSubscriptionSchema) }),
);

const conventionRightCommonSchema = z.object({
  kinds: z.array(
    z.enum(apiConsumerKinds, {
      error: localization.invalidEnum,
    }),
  ),
  scope: z
    .object({
      agencyKinds: z.array(agencyKindSchema),
      agencyIds: z.undefined().optional(),
    })
    .or(
      z.object({
        agencyKinds: z.undefined().optional(),
        agencyIds: z.array(agencyIdSchema),
      }),
    ),
});

const createConventionRightSchema = conventionRightCommonSchema.and(
  z.object({
    subscriptions: z.array(createWebhookSubscriptionSchema),
  }),
);

const conventionRightSchema = conventionRightCommonSchema.and(
  z.object({
    subscriptions: z.array(webhookSubscriptionSchema),
  }),
);

const writeApiConsumerRightsSchema: ZodSchemaWithInputMatchingOutput<WriteApiConsumerRights> =
  z.object({
    searchEstablishment: createSearchEstablishmentRightSchema,
    convention: createConventionRightSchema,
    statistics: statisticsRightSchema,
  });

const apiConsumerRightsSchema: ZodSchemaWithInputMatchingOutput<
  ApiConsumer["rights"]
> = z.object({
  searchEstablishment: searchEstablishmentRightSchema,
  convention: conventionRightSchema,
  statistics: statisticsRightSchema,
});

export const apiConsumerNameSchema = stringWithMaxLength255;
export const apiConsumerIdSchema = z.uuid(localization.invalidUuid);
const commonApiConsumerShape = {
  id: apiConsumerIdSchema,
  name: apiConsumerNameSchema,
  contact: apiConsumerContactSchema,
  rights: writeApiConsumerRightsSchema,
  description: z.string().max(255).optional(),
  expirationDate: makeDateStringSchema(),
};

export const writeApiConsumerSchema: ZodSchemaWithInputMatchingOutput<WriteApiConsumerParams> =
  z.object(commonApiConsumerShape);

export const apiConsumerSchema: ZodSchemaWithInputMatchingOutput<ApiConsumer> =
  z.object({
    ...commonApiConsumerShape,
    createdAt: makeDateStringSchema(),
    rights: apiConsumerRightsSchema,
    revokedAt: dateTimeIsoStringSchema.nullable(),
    currentKeyIssuedAt: dateTimeIsoStringSchema,
  });

export const apiConsumerSubscriptionIdSchema: ZodSchemaWithInputMatchingOutput<ApiConsumerSubscriptionId> =
  z.string();

export const apiConsumerReadSchema: ZodSchemaWithInputMatchingOutput<
  ApiConsumerName[]
> = z.array(zStringMinLength1Max255);
