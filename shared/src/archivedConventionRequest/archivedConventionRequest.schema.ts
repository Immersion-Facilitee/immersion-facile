import { z } from "zod";
import { conventionIdSchema } from "../convention/convention.schema";
import { emailSchema } from "../email/email.schema";
import { appellationAndRomeDtoSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import { siretSchema } from "../siret/siret.schema";
import {
  firstnameMandatorySchema,
  firstnameSchema,
  lastnameMandatorySchema,
  lastnameSchema,
} from "../user/user.schema";
import { makeDateStringSchema } from "../utils/date";
import {
  makeHardenedStringSchema,
  zStringMinLength1Max255,
} from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type ArchivedConventionRequestDto,
  type ArchivedConventionRequestId,
  type ArchivedConventionRequestReason,
  type ArchivedConventionRequestReasonFields,
  type ArchivedConventionRequestToReviewListDto,
  archivedConventionRequestReasons,
} from "./archivedConventionRequest.dto";

const archivedConventionRequestIdSchema: ZodSchemaWithInputMatchingOutput<ArchivedConventionRequestId> =
  z.uuid(localization.invalidUuid);

const archivedConventionRequestReasonsWithoutOther =
  archivedConventionRequestReasons.filter((reason) => reason !== "other");

const otherReasonSchema = makeHardenedStringSchema({
  min: 10,
  max: 100,
  minMessage: localization.minCharacters(10),
});

const archivedConventionRequestReasonFieldsSchema: ZodSchemaWithInputMatchingOutput<ArchivedConventionRequestReasonFields> =
  z.discriminatedUnion(
    "reason",
    [
      z.object({
        reason: z.literal("other"),
        otherReason: otherReasonSchema,
      }),
      z.object({
        reason: z.enum(archivedConventionRequestReasonsWithoutOther, {
          error: localization.invalidEnum,
        }),
      }),
    ],
    { error: localization.required },
  );

const archivedConventionRequestWithConventionIdSchema = z.object({
  id: archivedConventionRequestIdSchema,
  conventionSearchMethod: z.literal("withConventionId"),
  conventionId: conventionIdSchema,
});

const archivedConventionRequestWithConventionDetailsSchema = z.object({
  id: archivedConventionRequestIdSchema,
  conventionSearchMethod: z.literal("withConventionDetails"),
  beneficiaryFirstName: firstnameMandatorySchema,
  beneficiaryLastName: lastnameMandatorySchema,
  siret: siretSchema,
  immersionDate: zStringMinLength1Max255,
  immersionAppellation: appellationAndRomeDtoSchema,
});

export const archivedConventionRequestSchema: ZodSchemaWithInputMatchingOutput<ArchivedConventionRequestDto> =
  z
    .discriminatedUnion("conventionSearchMethod", [
      archivedConventionRequestWithConventionIdSchema,
      archivedConventionRequestWithConventionDetailsSchema,
    ])
    .and(archivedConventionRequestReasonFieldsSchema);

export const archivedConventionRequestReasonSchema: ZodSchemaWithInputMatchingOutput<ArchivedConventionRequestReason> =
  z.enum(archivedConventionRequestReasons);

export const archivedConventionRequestToReviewListDtoSchema: ZodSchemaWithInputMatchingOutput<ArchivedConventionRequestToReviewListDto> =
  z.array(
    z.object({
      id: zUuidLike,
      reason: archivedConventionRequestReasonSchema,
      createdAt: makeDateStringSchema(),
      requester: z.object({
        firstname: firstnameSchema,
        lastname: lastnameSchema,
        email: emailSchema,
      }),
    }),
  );
