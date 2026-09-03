import type { ConventionId } from "../convention/convention.dto";
import type { Email } from "../email/email.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";
import type { Flavor } from "../typeFlavors";
import type { Firstname, Lastname } from "../user/user.dto";
import type { DateString } from "../utils/date";

export type ArchivedConventionRequestId = Flavor<
  string,
  "ArchivedConventionRequestId"
>;

export type WithArchivedConventionRequestId = {
  archivedConventionRequestId: ArchivedConventionRequestId;
};

export const archivedConventionRequestReasons = [
  "legalDispute",
  "urssafOrInspectionControl",
  "rpeAdvisorAccessToBeneficiaryHistory",
  "other",
] as const;

export type ArchivedConventionRequestReason =
  (typeof archivedConventionRequestReasons)[number];

export const archivedConventionRequestHandledStatuses = [
  "TREATED",
  "REJECTED",
] as const;

export type ArchivedConventionRequestHandledStatus =
  (typeof archivedConventionRequestHandledStatuses)[number];

export const archivedConventionRequestStatuses = [
  "PENDING",
  ...archivedConventionRequestHandledStatuses,
] as const;

export type ArchivedConventionRequestStatus =
  (typeof archivedConventionRequestStatuses)[number];

export type HandleArchivedConventionRequestDto =
  WithArchivedConventionRequestId & {
    status: ArchivedConventionRequestHandledStatus;
  };

export type ArchivedConventionRequestReasonFields =
  | {
      reason: Exclude<ArchivedConventionRequestReason, "other">;
      otherReason?: never;
    }
  | {
      reason: Extract<ArchivedConventionRequestReason, "other">;
      otherReason: string;
    };

export type ArchivedConventionRequestWithConventionIdDto =
  ArchivedConventionRequestReasonFields & {
    id: ArchivedConventionRequestId;
    conventionSearchMethod: "withConventionId";
    conventionId: ConventionId;
    beneficiaryFirstName?: never;
    beneficiaryLastName?: never;
    siret?: never;
    immersionDate?: never;
    immersionAppellation?: never;
  };

export type ArchivedConventionRequestWithConventionDetailsDto =
  ArchivedConventionRequestReasonFields & {
    id: ArchivedConventionRequestId;
    conventionSearchMethod: "withConventionDetails";
    conventionId?: never;
    beneficiaryFirstName: Firstname;
    beneficiaryLastName: Lastname;
    siret: SiretDto;
    immersionDate: string;
    immersionAppellation: AppellationAndRomeDto;
  };

export type ArchivedConventionRequestDto =
  | ArchivedConventionRequestWithConventionIdDto
  | ArchivedConventionRequestWithConventionDetailsDto;

export type ArchivedConventionRequestToReviewFields =
  ArchivedConventionRequestReasonFields & {
    id: ArchivedConventionRequestId;
    createdAt: DateString;
  } & (
      | {
          conventionSearchMethod: "withConventionId";
          conventionId: ConventionId;
        }
      | {
          conventionSearchMethod: "withConventionDetails";
          beneficiaryFirstName: Firstname;
          beneficiaryLastName: Lastname;
          siret: SiretDto;
          immersionDate: string;
        }
    );

export type ArchivedConventionRequestToReviewDto =
  ArchivedConventionRequestToReviewFields & {
    requester: { firstname: Firstname; lastname: Lastname; email: Email };
  };

export type ArchivedConventionRequestToReviewListDto =
  ArchivedConventionRequestToReviewDto[];
