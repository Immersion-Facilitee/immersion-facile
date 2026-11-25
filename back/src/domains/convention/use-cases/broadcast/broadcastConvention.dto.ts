import type {
  AgencyId,
  CodeSafir,
  ConventionDto,
  ConventionId,
  DateString,
  DepartmentCode,
  Email,
  PartnerAgencyKind,
  PickFromExistingKeys,
  SiretDto,
  WithBannedEstablishmentInformations,
  WithEndedWithAJob,
  WithEstablishmentComments,
} from "shared";

export type BroadcastAgencyRefersTo = {
  id: AgencyId;
  name: string;
  kind: PartnerAgencyKind;
  siret: SiretDto;
  codeSafir: CodeSafir | null;
};

export type BroadcastConventionField =
  | "id"
  | "status"
  | "statusJustification"
  | "agencyId"
  | "dateSubmission"
  | "dateStart"
  | "dateEnd"
  | "dateValidation"
  | "dateApproval"
  | "siret"
  | "businessName"
  | "schedule"
  | "workConditions"
  | "businessAdvantages"
  | "individualProtection"
  | "individualProtectionDescription"
  | "sanitaryPrevention"
  | "sanitaryPreventionDescription"
  | "immersionAddress"
  | "immersionObjective"
  | "immersionAppellation"
  | "immersionActivities"
  | "immersionSkills"
  | "establishmentNumberEmployeesRange"
  | "establishmentTutor"
  | "validators"
  | "agencyReferent"
  | "renewed"
  | "internshipKind"
  | "signatories";

export type BroadcastConventionAgencyFields = {
  agencyName: string;
  agencyDepartment: DepartmentCode;
  agencyKind: PartnerAgencyKind;
  agencySiret: SiretDto;
  agencyCodeSafir: CodeSafir | null;
  agencyValidatorEmails: Email[];
  agencyRefersTo?: BroadcastAgencyRefersTo;
};

export type BroadcastConventionDto = PickFromExistingKeys<
  ConventionDto,
  BroadcastConventionField
> &
  WithBannedEstablishmentInformations &
  BroadcastConventionAgencyFields;

type BroadcastAssessmentCommon = {
  conventionId: ConventionId;
} & WithEstablishmentComments &
  WithEndedWithAJob;

export type BroadcastAssessmentDto =
  | (BroadcastAssessmentCommon & { status: "COMPLETED" })
  | (BroadcastAssessmentCommon & { status: "DID_NOT_SHOW" })
  | (BroadcastAssessmentCommon & {
      status: "PARTIALLY_COMPLETED";
      lastDayOfPresence: DateString;
      numberOfMissedHours: number;
    });

export type BroadcastPayload = {
  convention: BroadcastConventionDto;
  assessment?: BroadcastAssessmentDto;
};
