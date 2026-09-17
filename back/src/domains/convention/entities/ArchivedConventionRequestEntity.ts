import type {
  AppellationCode,
  ArchivedConventionRequestStatus,
  ArchivedConventionRequestWithConventionDetailsDto,
  ArchivedConventionRequestWithConventionIdDto,
  DateString,
  UserId,
} from "shared";

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
