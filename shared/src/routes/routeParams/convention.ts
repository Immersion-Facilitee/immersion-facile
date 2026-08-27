import { addDays, startOfToday } from "date-fns";

import { v4 as uuidV4 } from "uuid";
import type { ConventionDraftDto, FtConnectIdentity } from "../..";
import type { AgencyKind } from "../../agency/agency.dto";
import type {
  BeneficiaryCurrentEmployer,
  BeneficiaryRepresentative,
  ConventionDto,
  ImmersionObjective,
  InternshipKind,
  LevelOfEducation,
  Signatories,
} from "../../convention/convention.dto";
import type {
  CreateConventionPresentationInitialValues,
  CreateConventionTemplatePresentationInitialValues,
} from "../../convention/conventionPresentation.dto";
import type { ConventionTemplate } from "../../convention/conventionTemplate.dto";
import type { AppellationAndRomeDto } from "../../romeAndAppellationDtos/romeAndAppellation.dto";
import type { ScheduleDto } from "../../schedule/Schedule.dto";
import { reasonableSchedule } from "../../schedule/ScheduleUtils";
import type { SiretDto } from "../../siret/siret";
import { type DateString, toDateUTCString } from "../../utils/date";

export const makeEmptyConventionInitialValues = ({
  internshipKind,
  agencyDepartment,
  agencyKind,
  agencyId,
  agencyReferentFirstName,
  agencyReferentLastName,
  siret,
  immersionAppellation,
  immersionAddress,
}: {
  internshipKind: InternshipKind;
  agencyDepartment?: string;
  agencyKind?: AgencyKind;
  agencyId?: string;
  agencyReferentFirstName?: string;
  agencyReferentLastName?: string;
  siret?: SiretDto;
  immersionAppellation?: AppellationAndRomeDto;
  immersionAddress?: string;
}): CreateConventionPresentationInitialValues => {
  const dateStart = new Date();
  const dateEnd = addDays(dateStart, 1);
  const initialForm: CreateConventionPresentationInitialValues = {
    id: uuidV4(),
    agencyDepartment: agencyDepartment,
    agencyKind: agencyKind,
    agencyId: agencyId,
    agencyReferent: {
      firstname: agencyReferentFirstName,
      lastname: agencyReferentLastName,
    },
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
    schedule: reasonableSchedule({
      start: dateStart,
      end: dateEnd,
    }),
    siret,
    immersionAddress: immersionAddress,
    immersionAppellation: immersionAppellation,
    establishmentTutor: {
      role: "establishment-tutor",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      job: "",
    },
    signatories: {
      beneficiary: {
        role: "beneficiary",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        emergencyContact: "",
        emergencyContactPhone: "",
        emergencyContactEmail: "",
        address: undefined,
        schoolName: "",
        schoolPostcode: "",
        financiaryHelp: "",
        birthdate: "",
        isRqth: false,
      },
      establishmentRepresentative: {
        role: "establishment-representative",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
      beneficiaryRepresentative: beneficiaryRepresentativeFromParams({
        email: "",
        phone: "",
        firstName: "",
        lastName: "",
      }),
      beneficiaryCurrentEmployer: beneficiaryCurrentEmployerFromParams({
        businessName: "",
        businessSiret: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        job: "",
        businessAddress: "",
      }),
    },
    status: "READY_TO_SIGN",
    dateSubmission: toDateUTCString(new Date()),
    internshipKind,
  };

  return initialForm;
};

export const beneficiaryRepresentativeFromParams = ({
  email,
  phone,
  firstName,
  lastName,
}: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}): BeneficiaryRepresentative | undefined =>
  email || phone || firstName || lastName
    ? {
        role: "beneficiary-representative",
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        email: email ?? "",
        phone: phone ?? "",
      }
    : undefined;

const beneficiaryCurrentEmployerFromParams = ({
  businessName,
  businessSiret,
  firstName,
  lastName,
  email,
  phone,
  job,
  businessAddress,
}: {
  businessName?: string;
  businessSiret?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  job?: string;
  businessAddress?: string;
}): BeneficiaryCurrentEmployer | undefined =>
  businessName ||
  businessSiret ||
  firstName ||
  lastName ||
  email ||
  phone ||
  job ||
  businessAddress
    ? {
        businessSiret: businessSiret ?? "",
        businessName: businessName ?? "",
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        email: email ?? "",
        phone: phone ?? "",
        job: job ?? "",
        role: "beneficiary-current-employer",
        businessAddress: businessAddress ?? "",
      }
    : undefined;

const scheduleFromParams = ({
  dateStart: dateStartParam,
  dateEnd: dateEndParam,
  schedule: scheduleParam,
}: {
  dateStart?: DateString;
  dateEnd?: DateString;
  schedule?: ScheduleDto;
}): Pick<ConventionDto, "dateStart" | "dateEnd" | "schedule"> => {
  const dateStart =
    dateStartParam ?? toDateUTCString(addDays(startOfToday(), 2));
  const dateEnd = dateEndParam ?? toDateUTCString(addDays(startOfToday(), 3));
  return {
    dateStart,
    dateEnd,
    schedule:
      scheduleParam ??
      reasonableSchedule(
        {
          start: new Date(dateStart),
          end: new Date(dateEnd),
        },
        [],
        [],
      ),
  };
};

const getMiniStageSignatoryProperty = <
  S extends keyof Signatories<"mini-stage-cci">,
  K extends keyof NonNullable<Signatories<"mini-stage-cci">[S]>,
>({
  conventionDraft,
  signatoryKey,
  propertyKey,
}: {
  conventionDraft: ConventionDraftDto;
  signatoryKey: S;
  propertyKey: K;
}): NonNullable<Signatories<"mini-stage-cci">[S]>[K] | undefined => {
  if (
    conventionDraft.internshipKind === "mini-stage-cci" &&
    conventionDraft.signatories &&
    signatoryKey in conventionDraft.signatories &&
    conventionDraft.signatories[signatoryKey]
  ) {
    return (
      conventionDraft.signatories[signatoryKey] as NonNullable<
        Signatories<"mini-stage-cci">[S]
      >
    )[propertyKey];
  }
  return undefined;
};

export const conventionPresentationFromConventionDraft = (
  conventionDraft: ConventionDraftDto,
): CreateConventionPresentationInitialValues => ({
  id: uuidV4(),
  fromConventionDraftId: conventionDraft.id,
  updatedAt: conventionDraft.updatedAt,
  status: "READY_TO_SIGN",
  dateSubmission: toDateUTCString(new Date()),
  internshipKind: conventionDraft.internshipKind,

  // Agency
  agencyId: conventionDraft.agencyId,
  agencyDepartment: conventionDraft.agencyDepartment ?? "",
  agencyKind: conventionDraft.agencyKind as AgencyKind | undefined,
  agencyReferent: {
    firstname: conventionDraft.agencyReferent?.firstname ?? "",
    lastname: conventionDraft.agencyReferent?.lastname ?? "",
  },

  //Actors
  establishmentTutor: {
    role: "establishment-tutor",
    firstName: conventionDraft.establishmentTutor?.firstName ?? "",
    lastName: conventionDraft.establishmentTutor?.lastName ?? "",
    email: conventionDraft.establishmentTutor?.email ?? "",
    phone: conventionDraft.establishmentTutor?.phone ?? "",
    job: conventionDraft.establishmentTutor?.job ?? "",
  },
  isEstablishmentBanned: false,
  signatories: {
    beneficiary: {
      role: "beneficiary",
      firstName: conventionDraft.signatories?.beneficiary?.firstName ?? "",
      lastName: conventionDraft.signatories?.beneficiary?.lastName ?? "",
      email: conventionDraft.signatories?.beneficiary?.email ?? "",
      phone: conventionDraft.signatories?.beneficiary?.phone ?? "",
      emergencyContact:
        conventionDraft.signatories?.beneficiary?.emergencyContact ?? "",
      emergencyContactPhone:
        conventionDraft.signatories?.beneficiary?.emergencyContactPhone ?? "",
      emergencyContactEmail:
        conventionDraft.signatories?.beneficiary?.emergencyContactEmail ?? "",
      address: getMiniStageSignatoryProperty({
        conventionDraft,
        signatoryKey: "beneficiary",
        propertyKey: "address",
      }),
      levelOfEducation:
        (getMiniStageSignatoryProperty({
          conventionDraft,
          signatoryKey: "beneficiary",
          propertyKey: "levelOfEducation",
        }) as LevelOfEducation) ?? "",
      schoolName:
        getMiniStageSignatoryProperty({
          conventionDraft,
          signatoryKey: "beneficiary",
          propertyKey: "schoolName",
        }) ?? "",
      schoolPostcode:
        getMiniStageSignatoryProperty({
          conventionDraft,
          signatoryKey: "beneficiary",
          propertyKey: "schoolPostcode",
        }) ?? "",
      financiaryHelp:
        conventionDraft.signatories?.beneficiary?.financiaryHelp ?? "",
      birthdate: conventionDraft.signatories?.beneficiary?.birthdate ?? "",
      isRqth: conventionDraft.signatories?.beneficiary?.isRqth ?? false,
      ...(conventionDraft.signatories?.beneficiary?.federatedIdentity
        ?.provider &&
      conventionDraft.signatories?.beneficiary?.federatedIdentity?.token
        ? {
            federatedIdentity: {
              provider: conventionDraft.signatories?.beneficiary
                ?.federatedIdentity?.provider as FtConnectIdentity["provider"],
              token:
                conventionDraft.signatories?.beneficiary?.federatedIdentity
                  ?.token,
            },
          }
        : {}),
    },
    establishmentRepresentative: {
      role: "establishment-representative",
      firstName:
        conventionDraft.signatories?.establishmentRepresentative?.firstName ??
        "",
      lastName:
        conventionDraft.signatories?.establishmentRepresentative?.lastName ??
        "",
      email:
        conventionDraft.signatories?.establishmentRepresentative?.email ?? "",
      phone:
        conventionDraft.signatories?.establishmentRepresentative?.phone ?? "",
    },
    beneficiaryRepresentative: beneficiaryRepresentativeFromParams({
      email:
        conventionDraft.signatories?.beneficiaryRepresentative?.email ?? "",
      phone:
        conventionDraft.signatories?.beneficiaryRepresentative?.phone ?? "",
      firstName:
        conventionDraft.signatories?.beneficiaryRepresentative?.firstName ?? "",
      lastName:
        conventionDraft.signatories?.beneficiaryRepresentative?.lastName ?? "",
    }),
    beneficiaryCurrentEmployer: beneficiaryCurrentEmployerFromParams({
      businessName:
        conventionDraft.signatories?.beneficiaryCurrentEmployer?.businessName ??
        "",
      businessSiret:
        conventionDraft.signatories?.beneficiaryCurrentEmployer
          ?.businessSiret ?? "",
      firstName:
        conventionDraft.signatories?.beneficiaryCurrentEmployer?.firstName ??
        "",
      lastName:
        conventionDraft.signatories?.beneficiaryCurrentEmployer?.lastName ?? "",
      email:
        conventionDraft.signatories?.beneficiaryCurrentEmployer?.email ?? "",
      phone:
        conventionDraft.signatories?.beneficiaryCurrentEmployer?.phone ?? "",
      job: conventionDraft.signatories?.beneficiaryCurrentEmployer?.job ?? "",
      businessAddress:
        conventionDraft.signatories?.beneficiaryCurrentEmployer
          ?.businessAddress ?? "",
    }),
  },

  // Schedule
  ...scheduleFromParams({
    dateStart: conventionDraft.dateStart,
    dateEnd: conventionDraft.dateEnd,
    schedule: conventionDraft.schedule as ScheduleDto | undefined,
  }),

  // Enterprise
  siret: conventionDraft.siret ?? "",
  businessName: conventionDraft.businessName ?? "",
  businessNameCustomized: conventionDraft.businessNameCustomized ?? "",
  immersionAddress: conventionDraft.immersionAddress ?? "",
  workConditions: conventionDraft.workConditions ?? "",
  businessAdvantages: conventionDraft.businessAdvantages ?? "",

  // Covid
  individualProtection: conventionDraft.individualProtection ?? undefined,
  individualProtectionDescription:
    conventionDraft.individualProtectionDescription ?? "",
  sanitaryPrevention: conventionDraft.sanitaryPrevention ?? undefined,
  sanitaryPreventionDescription:
    conventionDraft.sanitaryPreventionDescription ?? "",

  // Immersion
  immersionObjective: conventionDraft.immersionObjective as
    | ImmersionObjective
    | undefined,
  remoteWorkMode: conventionDraft.remoteWorkMode,
  immersionAppellation: conventionDraft.immersionAppellation
    ? ({
        appellationCode: conventionDraft.immersionAppellation.appellationCode,
        appellationLabel: conventionDraft.immersionAppellation.appellationLabel,
        romeCode: conventionDraft.immersionAppellation.romeCode,
        romeLabel: conventionDraft.immersionAppellation.romeLabel,
      } as AppellationAndRomeDto)
    : undefined,
  immersionActivities: conventionDraft.immersionActivities ?? "",
  immersionSkills: conventionDraft.immersionSkills ?? "",
});

export const makeConventionTemplatePresentationFromConventionTemplate = (
  conventionTemplate: ConventionTemplate,
): CreateConventionTemplatePresentationInitialValues => {
  const { id, name, userId: _, ...conventionDraft } = conventionTemplate;
  return {
    ...conventionPresentationFromConventionDraft({
      ...conventionDraft,
      id: uuidV4(),
    }),
    id,
    name,
  };
};

export const makeConventionPresentationFromConventionTemplate = (
  conventionTemplate: ConventionTemplate,
): CreateConventionPresentationInitialValues => {
  const {
    id: _id,
    name: _name,
    userId: _userId,
    ...conventionDraft
  } = conventionTemplate;
  return conventionPresentationFromConventionDraft({
    ...conventionDraft,
    id: uuidV4(),
  });
};
