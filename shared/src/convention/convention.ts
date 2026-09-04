import {
  addDays,
  differenceInISOWeekYears,
  isAfter,
  subMonths,
} from "date-fns";
import { keys, mapObjIndexed, values } from "ramda";
import { agencyRoleIsNotToReview } from "../agency/agency.utils";
import {
  type AgencyRole,
  allSignatoryRoles,
  type ConventionEstablishmentRole,
  type EstablishmentRole,
  type Role,
  type SignatoryRole,
} from "../role/role.dto";
import type { UserWithRights } from "../user/user.dto";
import type {
  DotNestedKeys,
  ExcludeFromExisting,
  ExtractFromExisting,
} from "../utils";
import type { DateString } from "../utils/date";
import type {
  ConventionDto,
  ConventionRenewed,
  ConventionStatus,
  FlatGetConventionsForAgencyUserParams,
  GetConventionsForAgencyUserParams,
  Signatories,
  Signatory,
} from "./convention.dto";

export const allSignatoriesSigned = (signatories: Signatories) =>
  values(signatories).every((signatory) => !signatory || !!signatory.signedAt);

const getNewStatus = (signatories: Signatories): ConventionStatus => {
  if (allSignatoriesSigned(signatories)) return "IN_REVIEW";
  return "PARTIALLY_SIGNED";
};

const updateSignatoriesOnSignature = (
  signatories: Signatories,
  role: SignatoryRole,
  signedAt: string,
): Signatories => {
  switch (role) {
    case "beneficiary":
      return {
        ...signatories,
        beneficiary: { ...signatories.beneficiary, signedAt },
      };
    case "beneficiary-representative":
      if (!signatories.beneficiaryRepresentative)
        throw new Error(
          "There is no beneficiary representative on signatories.",
        );
      return {
        ...signatories,
        beneficiaryRepresentative: {
          ...signatories.beneficiaryRepresentative,
          signedAt,
        },
      };
    case "establishment-representative":
      return {
        ...signatories,
        establishmentRepresentative: {
          ...signatories.establishmentRepresentative,
          signedAt,
        },
      };
    default: {
      const keyOfRole = keys(signatories).find(
        (signatoryKey) => signatories[signatoryKey]?.role === role,
      );
      if (!keyOfRole) return signatories; // ToDo : throw Forbidden Error
      return {
        ...signatories,
        beneficiary: signatories.beneficiary,
        establishmentRepresentative: signatories.establishmentRepresentative,
        [keyOfRole]: { ...signatories[keyOfRole], signedAt },
      };
    }
  }
};

export const signConventionDtoWithRole = (
  convention: ConventionDto,
  role: SignatoryRole,
  signedAt: string,
): ConventionDto => {
  const updatedSignatories = updateSignatoriesOnSignature(
    convention.signatories,
    role,
    signedAt,
  );

  return {
    ...convention,
    signatories: updatedSignatories,
    status: getNewStatus(updatedSignatories),
  };
};

export const isSignatory = (role: Role): role is SignatoryRole =>
  allSignatoryRoles.includes(role as SignatoryRole);

export type ConventionField = DotNestedKeys<ConventionDto>;

export const getConventionFieldName = (name: ConventionField) => name;

export const isEstablishmentTutorIsEstablishmentRepresentative = (convention?: {
  establishmentTutor?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  signatories?: {
    establishmentRepresentative?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
  };
}): boolean => {
  const establishmentTutor = convention?.establishmentTutor;
  const establishmentRepresentative =
    convention?.signatories?.establishmentRepresentative;
  if (!establishmentTutor || !establishmentRepresentative) return false;
  return (
    establishmentTutor.firstName === establishmentRepresentative.firstName &&
    establishmentTutor.lastName === establishmentRepresentative.lastName &&
    establishmentTutor.email === establishmentRepresentative.email &&
    establishmentTutor.phone === establishmentRepresentative.phone
  );
};

export const isBeneficiaryMinorAccordingToAge = (
  conventionDateStart: DateString,
  beneficiaryBirthdate: string,
): boolean => {
  const age = differenceInISOWeekYears(
    new Date(conventionDateStart),
    new Date(beneficiaryBirthdate),
  );
  return age < 18;
};

export const isBeneficiaryMinor = ({
  hasBeneficiaryRepresentative,
  beneficiaryBirthdate,
  conventionDateStart,
}: {
  beneficiaryBirthdate: string;
  hasBeneficiaryRepresentative: boolean;
  conventionDateStart?: DateString;
}): boolean =>
  hasBeneficiaryRepresentative ||
  (!!conventionDateStart &&
    isBeneficiaryMinorAccordingToAge(
      conventionDateStart,
      beneficiaryBirthdate,
    ));

export const clearSignaturesAndValidationDate = <C extends ConventionDto>(
  convention: C,
): C => ({
  ...convention,
  dateValidation: undefined,
  signatories: mapObjIndexed(
    (value) => ({
      ...value,
      signedAt: undefined,
    }),
    convention.signatories,
  ),
});

export const isConventionRenewed = (
  convention: ConventionDto,
): convention is ConventionRenewed => {
  const renewedKey: keyof ConventionDto = "renewed";
  return renewedKey in convention;
};

export const isConventionValidated = (conventionStatus: ConventionStatus) =>
  conventionStatus === "ACCEPTED_BY_VALIDATOR";

export const hasAllowedRole = ({
  allowedRoles,
  candidateRoles,
}: {
  allowedRoles: Role[];
  candidateRoles: Role[];
}) =>
  candidateRoles.some((candidateRole) => allowedRoles.includes(candidateRole));

const processedDataBySignatoryRole: Record<
  SignatoryRole,
  {
    fieldName: ConventionField;
    signatoryFunction: string;
  }
> = {
  beneficiary: {
    fieldName: getConventionFieldName("signatories.beneficiary.signedAt"),
    signatoryFunction: "bénéficiaire",
  },
  "beneficiary-current-employer": {
    fieldName: getConventionFieldName(
      "signatories.beneficiaryCurrentEmployer.signedAt",
    ),
    signatoryFunction: "employeur actuel du bénéficiaire",
  },
  "establishment-representative": {
    fieldName: getConventionFieldName(
      "signatories.establishmentRepresentative.signedAt",
    ),
    signatoryFunction: "représentant de la structure d'accueil",
  },
  "beneficiary-representative": {
    fieldName: getConventionFieldName(
      "signatories.beneficiaryRepresentative.signedAt",
    ),
    signatoryFunction: "représentant légal du bénéficiaire",
  },
};

export const getSignatoryProcessedData = (
  signatory: Signatory,
): {
  fieldName: ConventionField;
  signatoryFullName: string;
  signatoryFunction: string;
} => ({
  ...processedDataBySignatoryRole[signatory.role],
  signatoryFullName: `${signatory.firstName} ${signatory.lastName}`,
});

export const flatParamsToGetConventionsForAgencyUserParams = (
  flatParams: FlatGetConventionsForAgencyUserParams,
): GetConventionsForAgencyUserParams => {
  const {
    sortBy,
    sortDirection,
    page,
    perPage,
    search,
    statuses,
    agencyIds,
    agencyDepartmentCodes,
    dateStartFrom,
    dateStartTo,
    dateEndFrom,
    dateEndTo,
    dateSubmissionFrom,
    dateSubmissionTo,
    assessmentCompletionStatus,
    ...rest
  } = flatParams;

  rest satisfies Record<string, never>;

  return {
    filters: {
      search,
      statuses,
      agencyIds,
      agencyDepartmentCodes,
      dateStart: (dateStartFrom || dateStartTo) && {
        from: dateStartFrom,
        to: dateStartTo,
      },
      dateEnd: (dateEndFrom || dateEndTo) && {
        from: dateEndFrom,
        to: dateEndTo,
      },
      dateSubmission: (dateSubmissionFrom || dateSubmissionTo) && {
        from: dateSubmissionFrom,
        to: dateSubmissionTo,
      },
      assessmentCompletionStatus,
    },
    sort: {
      by: sortBy,
      direction: sortDirection,
    },
    pagination: {
      page,
      perPage,
    },
  };
};

type ConnectedUserConventionManageAllowedRole =
  | EstablishmentRole
  | ConventionEstablishmentRole
  | ExtractFromExisting<Role, "back-office" | "beneficiary">
  | ExcludeFromExisting<AgencyRole, "to-review">;

export const getConventionManageAllowedRoles = (
  convention: ConventionDto,
  user: UserWithRights,
): ConnectedUserConventionManageAllowedRole[] => {
  const roles: ConnectedUserConventionManageAllowedRole[] = [];
  if (user.isBackofficeAdmin) roles.push("back-office");
  if (convention.signatories.beneficiary.email === user.email)
    roles.push("beneficiary");
  if (convention.signatories.establishmentRepresentative.email === user.email)
    roles.push("establishment-representative");
  if (convention.establishmentTutor.email === user.email)
    roles.push("establishment-tutor");
  const agencyRight = user.agencyRights.find(
    (agencyRight) => agencyRight.agency.id === convention.agencyId,
  );

  if (agencyRight && agencyRoleIsNotToReview(agencyRight.roles))
    roles.push(...agencyRight.roles);

  const establishmentRights = user.establishments?.find(
    (establishment) => establishment.siret === convention.siret,
  );
  if (establishmentRights) roles.push(establishmentRights.role);
  return roles;
};

export const isConventionEndingInOneDayOrMore = (dateEnd: DateString) =>
  isAfter(new Date(dateEnd), addDays(new Date(), 1));

export const defaultMonthsThresholdForConventionsListing = 25;

export const isConventionArchived = ({
  dateEnd,
  now,
}: {
  dateEnd: DateString;
  now: Date;
}): boolean =>
  new Date(dateEnd) <
  subMonths(now, defaultMonthsThresholdForConventionsListing);
