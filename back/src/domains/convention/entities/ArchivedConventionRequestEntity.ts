import {
  type AppellationCode,
  type ArchivedConventionRequestStatus,
  type ArchivedConventionRequestWithConventionDetailsDto,
  type ArchivedConventionRequestWithConventionIdDto,
  appellationCodeSchema,
  archivedConventionRequestReasonSchema,
  archivedConventionRequestReasons,
  archivedConventionRequestStatusSchema,
  type DateString,
  errors,
  firstnameMandatorySchema,
  lastnameMandatorySchema,
  siretSchema,
  type UserId,
  zStringMinLength1Max255,
} from "shared";
import { z } from "zod";

export type ArchivedConventionRequestEntity = (
  | ArchivedConventionRequestWithConventionIdDto
  | (Omit<
      ArchivedConventionRequestWithConventionDetailsDto,
      "immersionAppellation"
    > & {
      immersionAppellationCode: AppellationCode;
    })
) & {
  userId: UserId;
  createdAt: DateString;
  updatedAt: DateString;
  status: ArchivedConventionRequestStatus;
};

const archivedConventionRequestEntitySchema: z.ZodType<ArchivedConventionRequestEntity> =
  z
    .object({
      id: z.string(),
      userId: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      status: archivedConventionRequestStatusSchema,
    })
    .and(
      z.discriminatedUnion("conventionSearchMethod", [
        z.object({
          conventionSearchMethod: z.literal("withConventionId"),
          conventionId: z.string().min(1),
        }),
        z.object({
          conventionSearchMethod: z.literal("withConventionDetails"),
          beneficiaryFirstName: firstnameMandatorySchema,
          beneficiaryLastName: lastnameMandatorySchema,
          siret: siretSchema,
          immersionDate: zStringMinLength1Max255,
          immersionAppellationCode: appellationCodeSchema,
        }),
      ]),
    )
    .and(
      z.discriminatedUnion("reason", [
        z.object({
          reason: z.literal("other"),
          otherReason: z.string().default(""),
        }),
        z.object({
          reason: z.enum(
            archivedConventionRequestReasons.filter(
              (reason) => reason !== "other",
            ),
          ),
        }),
      ]),
    );

export const validateArchivedConventionRequestEntity = (request: {
  id: string;
  reason: string;
}): ArchivedConventionRequestEntity => {
  if (!archivedConventionRequestReasonSchema.safeParse(request.reason).success)
    throw errors.archivedConventionRequest.unknownReason({
      reason: request.reason,
    });

  const result = archivedConventionRequestEntitySchema.safeParse(request);
  if (!result.success)
    throw errors.archivedConventionRequest.incomplete({ id: request.id });

  return result.data;
};
