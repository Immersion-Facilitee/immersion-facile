import type {
  AppellationCode,
  ArchivedConventionRequestReason,
  ArchivedConventionRequestReasonFields,
  ArchivedConventionRequestStatus,
  ArchivedConventionRequestToReviewFields,
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
  updatedAt: DateString;
  status: ArchivedConventionRequestStatus;
};

type ArchivedConventionRequestRow = {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  status: ArchivedConventionRequestStatus;
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

const toReasonFields = (
  row: ArchivedConventionRequestRow,
): ArchivedConventionRequestReasonFields => {
  if (!isArchivedConventionRequestReason(row.reason))
    throw errors.archivedConventionRequest.unknownReason({
      reason: row.reason,
    });

  if (row.reason === "other")
    return {
      reason: "other",
      otherReason: row.other_reason ?? "",
    };

  return { reason: row.reason };
};

const toConventionDetailsFields = (row: ArchivedConventionRequestRow) => {
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

  return parseResult.data;
};

export const toArchivedConventionRequestEntity = (
  row: ArchivedConventionRequestRow,
): ArchivedConventionRequestEntity => {
  const reasonFields = toReasonFields(row);
  const common = {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    status: row.status,
    ...reasonFields,
  };

  if (row.convention_id)
    return {
      ...common,
      conventionSearchMethod: "withConventionId",
      conventionId: row.convention_id,
    };

  return {
    ...common,
    conventionSearchMethod: "withConventionDetails",
    ...toConventionDetailsFields(row),
  };
};

export const toArchivedConventionRequestToReviewListItem = (
  row: ArchivedConventionRequestRow,
): ArchivedConventionRequestToReviewFields & { userId: UserId } => {
  const reasonFields = toReasonFields(row);
  const common = {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    ...reasonFields,
  };

  if (row.convention_id)
    return {
      ...common,
      conventionSearchMethod: "withConventionId",
      conventionId: row.convention_id,
    };

  const details = toConventionDetailsFields(row);

  return {
    ...common,
    conventionSearchMethod: "withConventionDetails",
    beneficiaryFirstName: details.beneficiaryFirstName,
    beneficiaryLastName: details.beneficiaryLastName,
    siret: details.siret,
    immersionDate: details.immersionDate,
  };
};
