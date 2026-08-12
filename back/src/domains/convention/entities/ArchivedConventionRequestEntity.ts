import type {
  AppellationCode,
  ArchivedConventionRequestReason,
  ArchivedConventionRequestReasonFields,
  ArchivedConventionRequestWithConventionDetailsDto,
  ArchivedConventionRequestWithConventionIdDto,
  DateString,
  UserId,
  ZodSchemaWithInputMatchingOutput,
} from "shared";
import {
  appellationCodeSchema,
  archivedConventionRequestReasons,
  errors,
  firstnameMandatorySchema,
  lastnameMandatorySchema,
  siretSchema,
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
  handledAt: DateString | null;
};

type ArchivedConventionRequestRow = {
  id: string;
  user_id: string;
  created_at: Date;
  handled_at: Date | null;
  convention_id: string | null;
  beneficiary_first_name: string | null;
  beneficiary_last_name: string | null;
  siret: string | null;
  immersion_date: string | null;
  immersion_appellation_code: number | null;
  reason: string;
  other_reason: string | null;
};

const archivedConventionRequestDetailsFieldsSchema: ZodSchemaWithInputMatchingOutput<
  Omit<
    ArchivedConventionRequestWithConventionDetailsDto,
    "immersionAppellation" | "reason" | "id" | "conventionSearchMethod"
  > & {
    immersionAppellationCode: AppellationCode;
  }
> = z.object({
  beneficiaryFirstName: firstnameMandatorySchema,
  beneficiaryLastName: lastnameMandatorySchema,
  siret: siretSchema,
  immersionDate: zStringMinLength1Max255,
  immersionAppellationCode: appellationCodeSchema,
});

const isArchivedConventionRequestReason = (
  reason: string,
): reason is ArchivedConventionRequestReason =>
  archivedConventionRequestReasons.some((value) => value === reason);

export const toArchivedConventionRequestEntity = (
  row: ArchivedConventionRequestRow,
): ArchivedConventionRequestEntity => {
  if (!isArchivedConventionRequestReason(row.reason))
    throw errors.archivedConventionRequest.unknownReason({
      reason: row.reason,
    });

  const reasonFields: ArchivedConventionRequestReasonFields =
    row.reason === "other"
      ? {
          reason: "other",
          otherReason: row.other_reason ?? "",
        }
      : { reason: row.reason };

  const common = {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    handledAt: row.handled_at?.toISOString() ?? null,
    ...reasonFields,
  };

  if (row.convention_id)
    return {
      ...common,
      conventionSearchMethod: "withConventionId",
      conventionId: row.convention_id,
    };

  const parseResult = archivedConventionRequestDetailsFieldsSchema.safeParse({
    beneficiaryFirstName: row.beneficiary_first_name,
    beneficiaryLastName: row.beneficiary_last_name,
    siret: row.siret,
    immersionDate: row.immersion_date,
    immersionAppellationCode: row.immersion_appellation_code?.toString(),
  });

  if (!parseResult.success)
    throw errors.archivedConventionRequest.incomplete({
      id: row.id,
    });

  return {
    ...common,
    conventionSearchMethod: "withConventionDetails",
    ...parseResult.data,
  };
};
