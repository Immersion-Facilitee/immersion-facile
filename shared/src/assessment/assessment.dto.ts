import type { ConventionId } from "../convention/convention.dto";
import type { DateString, DateTimeIsoString } from "../utils/date";

export type AssessmentStatus = AssessmentDto["status"];
export const assessmentStatuses: AssessmentStatus[] = [
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "DID_NOT_SHOW",
] as const;
export type LegacyAssessmentStatus = (typeof legacyAssessmentStatuses)[number];
export const legacyAssessmentStatuses = ["FINISHED", "ABANDONED"] as const;
export const typeOfContracts = [
  "CDI",
  "CDD > ou = 6 mois",
  "CDD < 6 mois",
  "Alternance",
  "Contrat aidé",
  "Contrat d'insertion",
  "Autre",
] as const;
export type TypeOfContract = (typeof typeOfContracts)[number];

export type WithEndedWithAJob =
  | { endedWithAJob: false }
  | {
      endedWithAJob: true;
      typeOfContract: TypeOfContract;
      contractStartDate: DateString;
    };

export type WithEstablishmentComments = {
  establishmentFeedback: string;
  establishmentAdvices: string;
};

export type CommonAssessmentFields = {
  conventionId: ConventionId;
  beneficiaryAgreement: boolean | null;
  beneficiaryFeedback: string | null;
  signedAt: DateString | null;
} & WithEndedWithAJob &
  WithEstablishmentComments;

export type AssessmentDtoCompleted = CommonAssessmentFields & {
  status: "COMPLETED";
};

export type AssessmentDtoDidNotShow = CommonAssessmentFields & {
  status: "DID_NOT_SHOW";
};

export type AssessmentDtoPartiallyCompleted = CommonAssessmentFields & {
  status: "PARTIALLY_COMPLETED";
  lastDayOfPresence: DateString;
  numberOfMissedHours: number;
};

export type AssessmentDto = (
  | AssessmentDtoCompleted
  | AssessmentDtoDidNotShow
  | AssessmentDtoPartiallyCompleted
) & {
  createdAt: DateTimeIsoString;
};

export type WithAssessmentDto = {
  assessment: AssessmentDto;
};

export type DeleteAssessmentRequestDto = {
  conventionId: ConventionId;
  deleteAssessmentJustification: string;
};

export type SignAssessmentRequestDto = {
  conventionId: ConventionId;
} & (
  | {
      beneficiaryAgreement: true;
      beneficiaryFeedback: string | null;
    }
  | {
      beneficiaryAgreement: false;
      beneficiaryFeedback: string;
    }
);

export type AssessmentMode = "CreateAssessment" | "GetAssessment";

export type LegacyAssessmentDto = {
  status: LegacyAssessmentStatus;
  conventionId: ConventionId;
  establishmentFeedback: string;
  createdAt: DateTimeIsoString;
};

export type PartiallyCompletedAssessmentDetails = {
  lastDayOfPresence: DateString | null;
  numberOfMissedHours: number | null;
  numberOfMissedMinutes: number | null;
};

export type AssessmentFormCommonFields = {
  conventionId: ConventionId;
  endedWithAJob: boolean | null;
  typeOfContract: TypeOfContract | null;
  contractStartDate: DateString | null;
} & WithEstablishmentComments;

export type AssessmentFormDtoWithStatusNull = AssessmentFormCommonFields & {
  status: null;
};

export type AssessmentFormDtoCompleted = AssessmentFormCommonFields & {
  status: "COMPLETED";
};

export type AssessmentFormDtoDidNotShow = AssessmentFormCommonFields & {
  status: "DID_NOT_SHOW";
};

export type AssessmentFormDtoPartiallyCompleted = AssessmentFormCommonFields & {
  status: "PARTIALLY_COMPLETED";
  partialCompletionDetails: PartiallyCompletedAssessmentDetails;
};

export type AssessmentFormDto =
  | AssessmentFormDtoWithStatusNull
  | AssessmentFormDtoCompleted
  | AssessmentFormDtoDidNotShow
  | AssessmentFormDtoPartiallyCompleted;
