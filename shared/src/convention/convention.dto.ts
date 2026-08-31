import {
  addMilliseconds,
  differenceInYears,
  startOfDay,
  subMilliseconds,
} from "date-fns";
import { keys, values } from "ramda";
import type { WithAcquisition } from "../acquisition.dto";
import type {
  AddressDto,
  DepartmentCode,
  Postcode,
} from "../address/address.dto";
import type { AgencyId, AgencyKind } from "../agency/agency.dto";
import type {
  AssessmentStatus,
  LegacyAssessmentDto,
} from "../assessment/assessment.dto";
import type { Email } from "../email/email.dto";
import type { WithBannedEstablishmentInformations } from "../establishment/bannedEstablishmentInformations.dto";
import type {
  BusinessName,
  BusinessNameCustomized,
} from "../establishment/establishment.dto";
import type { FtConnectIdentity } from "../federatedIdentities/federatedIdentity.dto";
import type { DateFilter } from "../filters";
import type {
  PaginationQueryParams,
  WithOptionalSort,
} from "../pagination/pagination.dto";
import type { PhoneNumber } from "../phone/phone.dto";
import type { RemoteWorkMode } from "../remoteWorkMode/remoteWorkMode.dto";
import {
  type AgencyRole,
  allSignatoryRoles,
  type ConventionActorRole,
  type Role,
  type SignatoryRole,
} from "../role/role.dto";
import type {
  AppellationAndRomeDto,
  AppellationCode,
} from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { ScheduleDto } from "../schedule/Schedule.dto";
import type { NumberEmployeesRange, SiretDto } from "../siret/siret";
import type {
  expiredJwtErrorMessage,
  unsupportedMagicLinkErrorMessage,
} from "../tokens/jwt.dto";
import type { Flavor } from "../typeFlavors";
import type {
  Firstname,
  Lastname,
  UserWithAdminRights,
  UserWithAgencyRights,
} from "../user/user.dto";
import type { NotEmptyArray } from "../utils";
import {
  type DateString,
  type DateTimeIsoString,
  isInRange,
  type OptionalDateRange,
} from "../utils/date";
import type { WithFirstnameAndLastname } from "./convention.schema";
import type { ConventionDraftId } from "./conventionDraftId";

export type ConventionStatus = (typeof conventionStatuses)[number];

export const isBeneficiary = (
  beneficiary: Beneficiary<InternshipKind>,
): beneficiary is Beneficiary<"immersion"> =>
  !("levelOfEducation" in beneficiary);

export const isBeneficiaryStudent = (
  beneficiary: Beneficiary<InternshipKind>,
): beneficiary is Beneficiary<"mini-stage-cci"> =>
  "levelOfEducation" in beneficiary;

export const conventionStatusesWithoutJustificationNorValidator = [
  "READY_TO_SIGN",
  "PARTIALLY_SIGNED",
  "IN_REVIEW",
] as const;

export const updateConventionStatusWithoutJustificationTargetStatuses = [
  "READY_TO_SIGN",
  "PARTIALLY_SIGNED",
] as const;

export type UpdateConventionStatusWithoutJustificationTargetStatus =
  (typeof updateConventionStatusWithoutJustificationTargetStatuses)[number];

export const isUnvalidatedConventionStatus = (
  status: ConventionStatus | null,
): status is UnvalidatedConventionStatus =>
  unvalidatedConventionStatuses.includes(status as UnvalidatedConventionStatus);

export const doesStatusNeedsValidators = (
  initialStatus: ConventionStatus,
  targetStatus: ConventionStatus | null,
): targetStatus is ConventionStatusWithValidator => {
  const isValidatorRequired = conventionStatusesWithValidator.includes(
    targetStatus as ConventionStatusWithValidator,
  );
  return (
    isValidatorRequired &&
    (initialStatus === "IN_REVIEW" ||
      initialStatus === "ACCEPTED_BY_COUNSELLOR")
  );
};

export const conventionStatusesAllowedForModification: ConventionStatus[] = [
  "IN_REVIEW",
  "PARTIALLY_SIGNED",
  "READY_TO_SIGN",
  "ACCEPTED_BY_COUNSELLOR",
] as const;

export type UnvalidatedConventionStatus =
  (typeof unvalidatedConventionStatuses)[number];
export const unvalidatedConventionStatuses = [
  "REJECTED",
  "CANCELLED",
  "DEPRECATED",
] as const;
export type ConventionStatusWithValidator =
  (typeof conventionStatusesWithValidator)[number];
export const conventionStatusesWithValidator = [
  "ACCEPTED_BY_COUNSELLOR",
  "ACCEPTED_BY_VALIDATOR",
] as const;

export const conventionStatuses = [
  ...conventionStatusesWithoutJustificationNorValidator,
  ...unvalidatedConventionStatuses,
  ...conventionStatusesWithValidator,
] as const;

export const conventionStatusesDemonstratingUserActivity: ConventionStatus[] = [
  "IN_REVIEW",
  "ACCEPTED_BY_COUNSELLOR",
  "ACCEPTED_BY_VALIDATOR",
  "CANCELLED",
];

export const maxPresenceDaysByInternshipKind: Record<InternshipKind, number> = {
  immersion: 30,
  "mini-stage-cci": 5,
};

export const maximumCalendarDayByInternshipKind: Record<
  InternshipKind,
  number
> = {
  immersion: 30,
  "mini-stage-cci": 8,
};

export const DATE_CONSIDERED_OLD = new Date("2024-08-31");

const WEEKLY_HOURS = {
  THIRTY: 30,
  THIRTY_FIVE: 35,
  FORTY_EIGHT: 48,
};

const DAILY_HOURS = {
  SEVEN: 7,
  EIGHT: 8,
  FOURTEEN: 14,
};

const AGES = {
  ZERO: 0,
  TEN: 10,
  FIFTEEN: 15,
  SIXTEEN: 16,
  ONE_HUNDRED_AND_TWENTY: 120,
};

export const ageRequirementByInternshipKind: Record<InternshipKind, number> = {
  "mini-stage-cci": AGES.TEN,
  immersion: AGES.SIXTEEN,
};

export const IMMERSION_WEEKLY_LIMITED_SCHEDULE_HOURS = WEEKLY_HOURS.FORTY_EIGHT;
export const CCI_WEEKLY_LIMITED_SCHEDULE_HOURS = WEEKLY_HOURS.THIRTY;
export const CCI_WEEKLY_MAX_PERMITTED_HOURS = WEEKLY_HOURS.THIRTY_FIVE;
export const BENEFICIARY_MAXIMUM_AGE_REQUIREMENT = AGES.ONE_HUNDRED_AND_TWENTY;
export const CCI_WEEKLY_LIMITED_SCHEDULE_AGE = AGES.SIXTEEN;

export const CCI_15YO_REQUIREMENT_RELEASE_DATE = new Date("2023-12-22");
export const CCI_16YO_REQUIREMENT_RELEASE_DATE = new Date("2026-03-03");
export const CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE = new Date(
  "2026-08-21",
);

type MINI_STAGE_RULE = {
  maxWeeklyHours: number;
  maxDailyHours: number | null;
  ageStart: number;
  ageLimit: number;
  conventionSubmitDateRange: OptionalDateRange;
};
type MINI_STAGE_RULENAME =
  | "v0forall"
  | "v1before15yo"
  | "v1between15and16yo"
  | "v1from16yo"
  | "v2before15yo"
  | "currentbefore15yo"
  | "currentbetween15and16yo"
  | "currentfrom16yo";

const BEFORE_15YO_RELEASE: OptionalDateRange = {
  to: subMilliseconds(CCI_15YO_REQUIREMENT_RELEASE_DATE, 1),
};
const BETWEEN_15YO_AND_16YO_RELEASES: OptionalDateRange = {
  from: CCI_15YO_REQUIREMENT_RELEASE_DATE,
  to: CCI_16YO_REQUIREMENT_RELEASE_DATE,
};
const FROM_16YO_RELEASE: OptionalDateRange = {
  from: addMilliseconds(CCI_16YO_REQUIREMENT_RELEASE_DATE, 1),
};

export const MINI_STAGE_RULES: Record<MINI_STAGE_RULENAME, MINI_STAGE_RULE> = {
  v0forall: {
    maxDailyHours: null,
    maxWeeklyHours: WEEKLY_HOURS.FORTY_EIGHT,
    ageStart: AGES.FIFTEEN,
    ageLimit: AGES.ONE_HUNDRED_AND_TWENTY,
    conventionSubmitDateRange: BEFORE_15YO_RELEASE,
  },
  v1before15yo: {
    maxDailyHours: null,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY,
    ageStart: AGES.ZERO,
    ageLimit: AGES.FIFTEEN,
    conventionSubmitDateRange: BEFORE_15YO_RELEASE,
  },
  v1between15and16yo: {
    maxDailyHours: null,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY_FIVE,
    ageStart: AGES.FIFTEEN,
    ageLimit: AGES.SIXTEEN,
    conventionSubmitDateRange: BETWEEN_15YO_AND_16YO_RELEASES,
  },
  v1from16yo: {
    maxDailyHours: null,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY_FIVE,
    ageStart: AGES.SIXTEEN,
    ageLimit: AGES.ONE_HUNDRED_AND_TWENTY,
    conventionSubmitDateRange: BETWEEN_15YO_AND_16YO_RELEASES,
  },
  v2before15yo: {
    maxDailyHours: null,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY,
    ageStart: AGES.TEN,
    ageLimit: AGES.FIFTEEN,
    conventionSubmitDateRange: BETWEEN_15YO_AND_16YO_RELEASES,
  },
  currentbefore15yo: {
    maxDailyHours: DAILY_HOURS.SEVEN,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY,
    ageStart: AGES.TEN,
    ageLimit: AGES.FIFTEEN,
    conventionSubmitDateRange: FROM_16YO_RELEASE,
  },
  currentbetween15and16yo: {
    maxDailyHours: DAILY_HOURS.SEVEN,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY_FIVE,
    ageStart: AGES.FIFTEEN,
    ageLimit: AGES.SIXTEEN,
    conventionSubmitDateRange: FROM_16YO_RELEASE,
  },
  currentfrom16yo: {
    maxDailyHours: DAILY_HOURS.EIGHT,
    maxWeeklyHours: WEEKLY_HOURS.THIRTY_FIVE,
    ageStart: AGES.SIXTEEN,
    ageLimit: AGES.ONE_HUNDRED_AND_TWENTY,
    conventionSubmitDateRange: FROM_16YO_RELEASE,
  },
};

export const getMiniStageRule = (
  beneficiaryAgeAtConventionStart: number,
  conventionSubmissionDate: DateString,
): MINI_STAGE_RULE | undefined =>
  values(MINI_STAGE_RULES).find(
    (rule) =>
      beneficiaryAgeAtConventionStart >= rule.ageStart &&
      beneficiaryAgeAtConventionStart < rule.ageLimit &&
      isInRange(
        rule.conventionSubmitDateRange,
        new Date(conventionSubmissionDate),
      ),
  );

export const MAX_PRESENCE_DAYS_RELEASE_DATE = new Date("2025-03-27");
export const SIGNATORIES_PHONE_NUMBER_DISTINCT_RELEASE_DATE = new Date(
  "2025-04-30",
);

export const validatedConventionStatuses: ConventionStatus[] = [
  "ACCEPTED_BY_VALIDATOR",
];

export const reviewedConventionStatuses: ConventionStatus[] = [
  "ACCEPTED_BY_COUNSELLOR",
];

export type ConventionId = Flavor<string, "ConventionId">;
export type ConventionExternalId = Flavor<string, "ConventionExternalId">;

export const discoverObjective = "Découvrir un métier ou un secteur d'activité";
export const conventionObjectiveOptions = [
  "Confirmer un projet professionnel",
  "Initier une démarche de recrutement",
  discoverObjective,
] as const;

export type ImmersionObjective = (typeof conventionObjectiveOptions)[number];

export const internshipKinds = ["immersion", "mini-stage-cci"] as const;
export type InternshipKind = (typeof internshipKinds)[number];

export type ConventionCommon = {
  id: ConventionId;
  status: ConventionStatus;
  statusJustification?: string;
  agencyId: AgencyId;
  dateSubmission: DateString;
  dateStart: DateString;
  dateEnd: DateString;
  dateValidation?: DateString; // undefined until the convention is validated
  dateApproval?: DateString; // undefined until the convention is accepted by counsellor
  updatedAt?: DateString;
  siret: SiretDto;
  businessName: BusinessName;
  businessNameCustomized?: BusinessNameCustomized;
  schedule: ScheduleDto;
  workConditions?: string;
  businessAdvantages?: string;
  individualProtection: boolean;
  individualProtectionDescription: string;
  sanitaryPrevention: boolean;
  sanitaryPreventionDescription: string;
  remoteWorkMode: RemoteWorkMode;
  immersionAddress: string;
  immersionObjective: ImmersionObjective;
  immersionAppellation: AppellationAndRomeDto;
  immersionActivities: string;
  immersionSkills: string;
  establishmentNumberEmployeesRange?: NumberEmployeesRange;
  establishmentTutor: EstablishmentTutor;
  validators?: ConventionValidatorInputNames;
  agencyReferent?: WithOptionalFirstnameAndLastname;
  sourceConventionDraftId?: ConventionDraftId;
} & Partial<WithRenewed> &
  WithAcquisition;

export type ConventionRenewed = ConventionDto & WithRenewed;

export type Renewed = {
  from: ConventionId;
  justification: string;
};

export type WithRenewed = {
  renewed: Renewed;
};

export type ConventionValidatorInputNames = {
  agencyCounsellor?: WithOptionalFirstnameAndLastname;
  agencyValidator?: WithOptionalFirstnameAndLastname;
};

export type WithOptionalFirstnameAndLastname = {
  firstname?: Firstname;
  lastname?: Lastname;
};

export type ConventionInternshipKindSpecific<T extends InternshipKind> = {
  internshipKind: T;
  signatories: Signatories<T>;
};

export type ConventionDto = ConventionCommon &
  (
    | ConventionInternshipKindSpecific<"immersion">
    | ConventionInternshipKindSpecific<"mini-stage-cci">
  );

export type Signatories<T extends InternshipKind = InternshipKind> = {
  beneficiary: Beneficiary<T>;
  establishmentRepresentative: EstablishmentRepresentative;
  beneficiaryRepresentative?: BeneficiaryRepresentative;
  beneficiaryCurrentEmployer?: BeneficiaryCurrentEmployer;
};

export const signatoryKeys: (keyof Signatories)[] = [
  "beneficiary",
  "establishmentRepresentative",
  "beneficiaryRepresentative",
  "beneficiaryCurrentEmployer",
];

export const isSignatoryRole = (role: Role): role is SignatoryRole =>
  allSignatoryRoles.includes(role as SignatoryRole);

export type Signatory = GenericSignatory<SignatoryRole>;

export type GenericActor<R extends ConventionActorRole> = {
  role: R;
  email: Email;
  phone: PhoneNumber;
  firstName: Firstname;
  lastName: Lastname;
};

export type GenericSignatory<R extends ConventionActorRole> =
  GenericActor<R> & {
    signedAt?: string; // Date iso string
  };

type StudentProperties = {
  levelOfEducation: LevelOfEducation;
  schoolName: string;
  schoolPostcode: Postcode;
  address?: AddressDto;
};

export type Beneficiary<T extends InternshipKind> =
  GenericSignatory<"beneficiary"> & {
    emergencyContact?: string;
    emergencyContactPhone?: string;
    emergencyContactEmail?: Email;
    federatedIdentity?: FtConnectIdentity;
    financiaryHelp?: string;
    birthdate: string; // Date iso string
    isRqth?: boolean;
    // biome-ignore lint/complexity/noBannedTypes: we need {} here
  } & (T extends "mini-stage-cci" ? StudentProperties : {});

export type LevelOfEducation = (typeof levelsOfEducation)[number];

export const levelsOfEducation = [
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
  "Etude supérieure 1ère année",
  "Etude supérieure 2ème année",
  "Etude supérieure 3ème année",
  "Etude supérieure 4ème année",
  "Etude supérieure 5ème année",
  "Etude supérieure 6ème année",
  "Etude supérieure 7ème année",
  "Etude supérieure 8ème année",
] as const;

export type BeneficiaryRepresentative =
  GenericSignatory<"beneficiary-representative">;

export type BeneficiaryCurrentEmployer =
  GenericSignatory<"beneficiary-current-employer"> & {
    job: string;
    businessSiret: string;
    businessName: string;
    businessAddress: string;
  };

export type EstablishmentRepresentative =
  GenericSignatory<"establishment-representative">;

export type EstablishmentTutor = GenericActor<"establishment-tutor"> & {
  job: string;
};

export type AgencyRefersToInConvention = {
  id: AgencyId;
  name: string;
  contactEmail: Email;
  kind: AgencyKind;
  siret: SiretDto;
};

export type AgencyValidationStep = (typeof agencyValidationSteps)[number];

export const agencyValidationSteps = [
  "validator-only",
  "counsellor-and-validator",
] as const;

export type ConventionAgencyPublicFields = {
  agencyName: string;
  agencyDepartment: DepartmentCode;
  agencyContactEmail: Email;
  agencyKind: AgencyKind;
  agencySiret: SiretDto;
  agencyValidationSteps: AgencyValidationStep;
  agencyRefersTo?: AgencyRefersToInConvention;
};

export type ConventionAssessmentFields = {
  assessment:
    | {
        status: AssessmentStatus;
        endedWithAJob: boolean;
        signedAt: DateString | null;
        createdAt: DateTimeIsoString;
      }
    | { status: LegacyAssessmentDto["status"]; createdAt: DateTimeIsoString }
    | null;
};

export type LastReminderDateByNotificationKind = {
  email: DateTimeIsoString | null;
  sms: DateTimeIsoString | null;
};

export type ConventionLastReminders = {
  conventionSignatures: Record<
    SignatoryRole,
    LastReminderDateByNotificationKind
  >;
  assessmentCompletion: LastReminderDateByNotificationKind;
  assessmentSignature: LastReminderDateByNotificationKind;
};

export type ConventionLastRemindersFields = {
  lastReminders: ConventionLastReminders;
};

export const makeEmptyLastReminders = (): ConventionLastReminders => ({
  conventionSignatures: {
    beneficiary: { email: null, sms: null },
    "beneficiary-representative": { email: null, sms: null },
    "beneficiary-current-employer": { email: null, sms: null },
    "establishment-representative": { email: null, sms: null },
  },
  assessmentCompletion: { email: null, sms: null },
  assessmentSignature: { email: null, sms: null },
});

export type ConventionReadDto = ConventionDto &
  ConventionAgencyPublicFields &
  ConventionAssessmentFields &
  ConventionLastRemindersFields &
  WithBannedEstablishmentInformations;

export type WithConventionIdLegacy = {
  id: ConventionId;
};

export type WithConventionId = {
  conventionId: ConventionId;
};
export type WithConventionDto = {
  convention: ConventionDto;
};

export type TransferConventionToAgencyRequestDto = WithConventionId & {
  agencyId: AgencyId;
  justification: string;
};

export type EditConventionCounsellorNameRequestDto = WithConventionId &
  WithOptionalFirstnameAndLastname;

export type EditConventionWithFinalStatusEstablishmentTutorUpdate =
  WithOptionalFirstnameAndLastname & {
    job?: string;
    email?: Email;
    phone?: PhoneNumber;
  };

export type EditConventionWithFinalStatusBeneficiaryUpdate =
  WithOptionalFirstnameAndLastname & {
    updatedBeneficiaryBirthDate?: DateString;
  };

export type EditConventionWithFinalStatusRequestDto = WithConventionId & {
  establishmentTutor?: EditConventionWithFinalStatusEstablishmentTutorUpdate;
  beneficiary?: EditConventionWithFinalStatusBeneficiaryUpdate;
};

export type EditConventionWithFinalStatusFormValues = WithConventionId & {
  establishmentTutor: WithFirstnameAndLastname & {
    job: string;
    email: Email;
    phone: PhoneNumber;
  };
  beneficiary?: Partial<
    WithFirstnameAndLastname & {
      updatedBeneficiaryBirthDate: DateString;
    }
  >;
};

export type UpdateConventionRequestDto = {
  convention: ConventionDto;
};

export type UpdateConventionStatusWithValidator = {
  status: ConventionStatusWithValidator;
  conventionId: ConventionId;
  lastname: Lastname;
  firstname: Firstname;
};

export type UpdateConventionStatusWithoutJustification = {
  status: UpdateConventionStatusWithoutJustificationTargetStatus;
  conventionId: ConventionId;
};

export type UpdateConventionStatusWithJustification = {
  status: UnvalidatedConventionStatus;
  conventionId: ConventionId;
  statusJustification: string;
};

export type UpdateConventionStatusRequestDto =
  | UpdateConventionStatusWithoutJustification
  | UpdateConventionStatusWithJustification
  | UpdateConventionStatusWithValidator;

const _isAssignable = (
  isValid: UpdateConventionStatusRequestDto,
): { status: ConventionStatus } => isValid;

export type GenerateMagicLinkRequestDto = {
  applicationId: ConventionId;
  role: Role;
  expired: boolean;
};

export type RenewExpiredJwtResponse = {
  message:
    | typeof expiredJwtErrorMessage
    | typeof unsupportedMagicLinkErrorMessage;
  needsNewMagicLink: boolean;
};

export type RenewConventionParams = Pick<
  ConventionRenewed,
  "id" | "dateStart" | "dateEnd" | "schedule" | "renewed"
>;

export type MarkPartnersErroredConventionAsHandledRequest = {
  conventionId: ConventionId;
};

export type FindSimilarConventionsParams = {
  siret: SiretDto;
  codeAppellation: AppellationCode;
  dateStart: DateString;
  beneficiaryBirthdate: DateString;
  beneficiaryLastName: string;
};

export type FindSimilarConventionsResponseDto = {
  similarConventionIds: ConventionId[];
};

export const labelsForImmersionObjective: Record<ImmersionObjective, string> = {
  "Confirmer un projet professionnel": "Je compte me former à ce métier",
  "Découvrir un métier ou un secteur d'activité":
    "J'en suis au premier stade de mon orientation et je veux en savoir plus sur ce métier",
  "Initier une démarche de recrutement": "Je suis à la recherche d'un emploi",
};

export const isStringImmersionObjective = (
  objective: string | unknown,
): objective is ImmersionObjective =>
  keys(labelsForImmersionObjective).includes(objective as ImmersionObjective);

export const reminderKinds = [
  "ReminderForSignatories",
  "FirstReminderForAgency",
  "LastReminderForAgency",
] as const;

export type ReminderKind = (typeof reminderKinds)[number];

export const userHasEnoughRightsOnConvention = (
  user: UserWithAdminRights & UserWithAgencyRights,
  convention: ConventionDto,
  allowedRoles: AgencyRole[],
): boolean =>
  user.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.id === convention.agencyId &&
      agencyRight.roles.some((role) => allowedRoles.includes(role)),
  ) || !!user.isBackofficeAdmin;

export const getExactAge = ({
  birthDate,
  referenceDate,
}: {
  birthDate: Date;
  referenceDate: Date;
}): number => {
  return differenceInYears(startOfDay(referenceDate), startOfDay(birthDate));
};

export const assessmentCompletionStatusFilters = [
  "finalized",
  "to-sign",
  "to-complete",
] as const;

export type AssessmentCompletionStatusFilter =
  (typeof assessmentCompletionStatusFilters)[number];

export type GetConventionsForAgencyUserFilters = {
  search?: string;
  statuses?: NotEmptyArray<ConventionStatus>;
  agencyIds?: NotEmptyArray<AgencyId>;
  agencyDepartmentCodes?: NotEmptyArray<string>;
  dateStart?: DateFilter;
  dateEnd?: DateFilter;
  dateSubmission?: DateFilter;
  assessmentCompletionStatus?: AssessmentCompletionStatusFilter[];
};

export type GetPaginatedConventionsSortBy = keyof Pick<
  ConventionDto,
  "dateValidation" | "dateStart" | "dateSubmission" | "dateEnd"
>;

export type GetConventionsForAgencyUserParams =
  WithOptionalSort<GetPaginatedConventionsSortBy> & {
    filters?: GetConventionsForAgencyUserFilters;
    pagination?: PaginationQueryParams;
  };

export type ConventionSortDirection = "asc" | "desc";

export type FlatGetConventionsForAgencyUserParams = {
  // pagination
  page?: number;
  perPage?: number;

  // sort
  sortBy?: GetPaginatedConventionsSortBy;
  sortDirection?: ConventionSortDirection;

  // filters
  search?: string;
  statuses?: NotEmptyArray<ConventionStatus>;
  agencyIds?: NotEmptyArray<AgencyId>;
  agencyDepartmentCodes?: NotEmptyArray<string>;

  // date filters
  dateStartFrom?: DateString;
  dateStartTo?: DateString;
  dateEndFrom?: DateString;
  dateEndTo?: DateString;
  dateSubmissionFrom?: DateString;
  dateSubmissionTo?: DateString;

  // assessment filter
  assessmentCompletionStatus?: AssessmentCompletionStatusFilter[];
};
