import { differenceInYears } from "date-fns";
import { z } from "zod";
import { withAcquisitionShape } from "../acquisition.dto";
import { getCountryCodeFromAddress } from "../address/address.dto";
import { addressDepartmentCodeSchema } from "../address/address.schema";
import {
  agencyIdSchema,
  agencyKindSchema,
  agencyNameSchema,
  refersToAgencyIdSchema,
} from "../agency/agency.schema";
import {
  assessmentStatuses,
  legacyAssessmentStatuses,
} from "../assessment/assessment.dto";
import { emailPossiblyEmptySchema, emailSchema } from "../email/email.schema";
import { withBannedEstablishmentInformationSchema } from "../establishment/bannedEstablishmentInformations.schema";
import {
  businessAddressSchema,
  businessCustomizedNameSchema,
  businessNameSchema,
} from "../establishment/businessComponents.schema";
import { ftConnectIdentitySchema } from "../federatedIdentities/federatedIdentity.schema";
import { dateFilterSchema } from "../filters";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
  withOptionalSortSchema,
} from "../pagination/pagination.schema";
import { phoneNumberSchema } from "../phone/phone.schema";
import { remoteWorkModeSchema } from "../remoteWorkMode/remoteWorkMode.schema";
import { allRoles, allSignatoryRoles } from "../role/role.dto";
import {
  appellationAndRomeDtoSchema,
  appellationCodeSchema,
} from "../romeAndAppellationDtos/romeAndAppellation.schema";
import type { DailyScheduleDto } from "../schedule/Schedule.dto";
import { scheduleSchema } from "../schedule/Schedule.schema";
import {
  calculateDailyHoursFromSchedule,
  calculateWeeklyHoursFromSchedule,
  isSundayInSchedule,
  validateSchedule,
} from "../schedule/ScheduleUtils";
import {
  numberOfEmployeesRangeSchema,
  siretSchema,
} from "../siret/siret.schema";
import {
  firstnameMandatorySchema,
  firstnameSchema,
  lastnameMandatorySchema,
  lastnameSchema,
} from "../user/user.schema";
import type { OmitFromExistingKeys } from "../utils";
import {
  type DateString,
  dateTimeIsoStringSchema,
  makeDateStringSchema,
} from "../utils/date";
import { addressWithPostalCodeSchema } from "../utils/postalCode";
import {
  optionalEmptyStringMax1024,
  stringWithMaxLength255,
  zStringCanBeEmpty,
  zStringCanBeEmptyMax1800,
  zStringCanBeEmptyMax3000,
  zStringCanBeEmptyMax6000,
  zStringMinLength1Max1024,
  zStringMinLength1Max3000,
  zStringMinLength1Max6000,
  zStringPossiblyEmptyWithMax,
  zTrimmedStringWithMax,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zBoolean,
  zEnumValidation,
  zToNumber,
} from "../zodUtils";
import { getConventionFieldName } from "./convention";
import {
  type AgencyValidationStep,
  agencyValidationSteps,
  ageRequirementByInternshipKind,
  assessmentCompletionStatusFilters,
  BENEFICIARY_MAXIMUM_AGE_REQUIREMENT,
  type Beneficiary,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE,
  type ConventionAssessmentFields,
  type ConventionCommon,
  type ConventionDto,
  type ConventionId,
  type ConventionInternshipKindSpecific,
  type ConventionLastReminders,
  type ConventionReadDto,
  type ConventionStatus,
  type ConventionValidatorInputNames,
  conventionObjectiveOptions,
  conventionStatuses,
  conventionStatusesWithValidator,
  DATE_CONSIDERED_OLD,
  type EditConventionCounsellorNameRequestDto,
  type EditConventionWithFinalStatusFormValues,
  type EditConventionWithFinalStatusRequestDto,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  type FindSimilarConventionsParams,
  type FindSimilarConventionsResponseDto,
  type FlatGetConventionsForAgencyUserParams,
  type GenerateMagicLinkRequestDto,
  type GetConventionsForAgencyUserParams,
  getExactAge,
  getMiniStageRule,
  type ImmersionObjective,
  type InternshipKind,
  internshipKinds,
  type LastReminderDateByNotificationKind,
  levelsOfEducation,
  type MarkPartnersErroredConventionAsHandledRequest,
  type RenewConventionParams,
  SIGNATORIES_PHONE_NUMBER_DISTINCT_RELEASE_DATE,
  type Signatories,
  signatoryKeys,
  type TransferConventionToAgencyRequestDto,
  type UpdateConventionRequestDto,
  type UpdateConventionStatusRequestDto,
  type UpdateConventionStatusWithJustification,
  type UpdateConventionStatusWithoutJustification,
  type UpdateConventionStatusWithValidator,
  unvalidatedConventionStatuses,
  updateConventionStatusWithoutJustificationTargetStatuses,
  type WithConventionDto,
  type WithConventionId,
  type WithConventionIdLegacy,
  type WithOptionalFirstnameAndLastname,
} from "./convention.dto";
import { conventionDraftIdSchema } from "./conventionDraftId";
import {
  getConventionTooLongMessageAndPath,
  getOverMaxWorkedDaysMessageAndPath,
  isTutorEmailDifferentThanBeneficiaryRelatedEmails,
  minorBeneficiaryHasRepresentative,
  mustBeSignedByEveryone,
  startDateIsBeforeEndDate,
  underMaxCalendarDuration,
  underMaxPresenceDays,
  validateBeneficiaryAddressAndParse,
} from "./conventionRefinements";

export const conventionIdSchema: ZodSchemaWithInputMatchingOutput<ConventionId> =
  z.uuid(localization.invalidUuid);

const roleSchema = z.enum(allRoles, {
  error: localization.invalidEnum,
});

const actorSchema = z.object({
  role: roleSchema,
  email: emailSchema,
  phone: phoneNumberSchema,
  firstName: firstnameMandatorySchema,
  lastName: lastnameMandatorySchema,
});

const signatorySchema = actorSchema.merge(
  z.object({
    signedAt: makeDateStringSchema().optional(),
  }),
);

const beneficiarySchema: ZodSchemaWithInputMatchingOutput<
  Beneficiary<"immersion">
> = signatorySchema.merge(
  z.object({
    role: z.literal("beneficiary"),
    emergencyContact: optionalEmptyStringMax1024,
    emergencyContactPhone: phoneNumberSchema.optional().or(z.literal("")),
    emergencyContactEmail: emailPossiblyEmptySchema,
    federatedIdentity: ftConnectIdentitySchema.optional(),
    financiaryHelp: zStringCanBeEmptyMax1800.optional(),
    birthdate: makeDateStringSchema(),
    isRqth: zBoolean.optional(),
  }),
);
const studentBeneficiarySchema: ZodSchemaWithInputMatchingOutput<
  Beneficiary<"mini-stage-cci">
> = beneficiarySchema.and(
  z.object({
    levelOfEducation: zEnumValidation(
      levelsOfEducation,
      "Votre niveau d'étude est obligatoire.",
    ),
    schoolName: stringWithMaxLength255,
    schoolPostcode: stringWithMaxLength255,
    address: z
      .object({
        streetNumberAndAddress: zStringCanBeEmpty,
        postcode: stringWithMaxLength255,
        departmentCode: stringWithMaxLength255,
        city: stringWithMaxLength255,
      })
      .optional(),
  }),
);

export const establishmentTutorSchema: ZodSchemaWithInputMatchingOutput<EstablishmentTutor> =
  actorSchema.extend({
    role: z.literal("establishment-tutor"),
    job: stringWithMaxLength255,
  });

const establishmentRepresentativeSchema: ZodSchemaWithInputMatchingOutput<EstablishmentRepresentative> =
  signatorySchema.extend({
    role: z.literal("establishment-representative"),
  });

const beneficiaryRepresentativeSchema: ZodSchemaWithInputMatchingOutput<BeneficiaryRepresentative> =
  signatorySchema.extend({
    role: z.literal("beneficiary-representative"),
  });

const beneficiaryCurrentEmployerSchema: ZodSchemaWithInputMatchingOutput<BeneficiaryCurrentEmployer> =
  signatorySchema.merge(
    z.object({
      role: z.literal("beneficiary-current-employer"),
      job: zStringCanBeEmpty,
      businessSiret: siretSchema,
      businessName: businessNameSchema,
      businessAddress: businessAddressSchema,
    }),
  );

export const immersionObjectiveSchema: ZodSchemaWithInputMatchingOutput<ImmersionObjective> =
  zEnumValidation<ImmersionObjective>(
    conventionObjectiveOptions,
    localization.invalidImmersionObjective,
  );

export const withOptionalFirstnameAndLastnameSchema: ZodSchemaWithInputMatchingOutput<WithOptionalFirstnameAndLastname> =
  z.object({
    firstname: firstnameSchema.optional(),
    lastname: lastnameSchema.optional(),
  });

//todo: to remove that when data in db is cleaned up and put a more strict schema (personNameSchema)
const conventionValidatorFirstnameAndLastnameSchema: ZodSchemaWithInputMatchingOutput<WithOptionalFirstnameAndLastname> =
  z.object({
    firstname: z.string().optional(),
    lastname: z.string().optional(),
  });

export const conventionValidatorsSchema: ZodSchemaWithInputMatchingOutput<ConventionValidatorInputNames> =
  z.object({
    agencyCounsellor: conventionValidatorFirstnameAndLastnameSchema.optional(),
    agencyValidator: conventionValidatorFirstnameAndLastnameSchema.optional(),
  });

export const editConventionCounsellorNameRequestSchema: ZodSchemaWithInputMatchingOutput<EditConventionCounsellorNameRequestDto> =
  withOptionalFirstnameAndLastnameSchema.and(
    z.object({
      conventionId: conventionIdSchema,
    }),
  );

const editConventionWithFinalStatusEstablishmentTutorUpdateSchema = z.object({
  firstname: firstnameMandatorySchema.optional(),
  lastname: lastnameMandatorySchema.optional(),
  job: stringWithMaxLength255.optional(),
  email: emailSchema.optional(),
  phone: phoneNumberSchema.optional(),
});

const editConventionWithFinalStatusBeneficiaryUpdateSchema = z.object({
  updatedBeneficiaryBirthDate: makeDateStringSchema().optional(),
  firstname: firstnameMandatorySchema.optional(),
  lastname: lastnameMandatorySchema.optional(),
});

export const editConventionWithFinalStatusRequestSchema: ZodSchemaWithInputMatchingOutput<EditConventionWithFinalStatusRequestDto> =
  z.object({
    conventionId: conventionIdSchema,
    establishmentTutor:
      editConventionWithFinalStatusEstablishmentTutorUpdateSchema.optional(),
    beneficiary:
      editConventionWithFinalStatusBeneficiaryUpdateSchema.optional(),
  });

const editConventionWithFinalStatusFormEstablishmentTutorSchema = z.object({
  firstname: firstnameMandatorySchema,
  lastname: lastnameMandatorySchema,
  job: stringWithMaxLength255,
  email: emailSchema,
  phone: phoneNumberSchema,
});

const editConventionWithFinalStatusFormBeneficiarySchema = z.object({
  updatedBeneficiaryBirthDate: makeDateStringSchema().optional(),
  firstname: firstnameMandatorySchema.optional(),
  lastname: lastnameMandatorySchema.optional(),
});

export const editConventionWithFinalStatusFormSchema: ZodSchemaWithInputMatchingOutput<EditConventionWithFinalStatusFormValues> =
  z.object({
    conventionId: conventionIdSchema,
    establishmentTutor:
      editConventionWithFinalStatusFormEstablishmentTutorSchema,
    beneficiary: editConventionWithFinalStatusFormBeneficiarySchema.optional(),
  });

export const renewedSchema = z.object({
  from: conventionIdSchema,
  justification: zStringMinLength1Max3000,
});

export const conventionStatusSchema: ZodSchemaWithInputMatchingOutput<ConventionStatus> =
  z.enum(conventionStatuses, {
    error: localization.invalidEnum,
  });

export const conventionDateStartSchema: ZodSchemaWithInputMatchingOutput<DateString> =
  makeDateStringSchema(localization.invalidDateStart);
export const conventionDateEndSchema: ZodSchemaWithInputMatchingOutput<DateString> =
  makeDateStringSchema(localization.invalidDateEnd);

export const conventionCommonSchema = z
  .object({
    id: conventionIdSchema,
    status: conventionStatusSchema,
    statusJustification: zStringCanBeEmptyMax6000.optional(),
    agencyId: agencyIdSchema,
    updatedAt: makeDateStringSchema().optional(),
    dateSubmission: makeDateStringSchema(),
    dateStart: conventionDateStartSchema,
    dateEnd: conventionDateEndSchema,
    dateValidation: makeDateStringSchema(
      localization.invalidValidationFormatDate,
    ).optional(),
    dateApproval: makeDateStringSchema(
      localization.invalidApprovalFormatDate,
    ).optional(),
    siret: siretSchema,
    businessName: businessNameSchema,
    businessNameCustomized: businessCustomizedNameSchema.optional(),
    schedule: scheduleSchema,
    workConditions: zStringCanBeEmptyMax6000.optional(),
    businessAdvantages: zStringCanBeEmptyMax3000.optional(),
    individualProtection: zBoolean,
    individualProtectionDescription: zStringPossiblyEmptyWithMax(255),
    sanitaryPrevention: zBoolean,
    sanitaryPreventionDescription: zStringPossiblyEmptyWithMax(255),
    remoteWorkMode: remoteWorkModeSchema,
    immersionAddress: addressWithPostalCodeSchema,
    immersionObjective: immersionObjectiveSchema,
    immersionAppellation: appellationAndRomeDtoSchema,
    immersionActivities: zTrimmedStringWithMax(2000),
    immersionSkills: zStringPossiblyEmptyWithMax(2000),
    establishmentTutor: establishmentTutorSchema,
    validators: conventionValidatorsSchema.optional(),
    agencyReferent: withOptionalFirstnameAndLastnameSchema.optional(),
    renewed: renewedSchema.optional(),
    establishmentNumberEmployeesRange: numberOfEmployeesRangeSchema.optional(),
    sourceConventionDraftId: conventionDraftIdSchema.optional(),
  })
  .extend(
    withAcquisitionShape,
  ) satisfies ZodSchemaWithInputMatchingOutput<ConventionCommon>;

export const internshipKindSchema: ZodSchemaWithInputMatchingOutput<InternshipKind> =
  z.enum(internshipKinds, {
    error: localization.invalidEnum,
  });

const immersionSignatoriesSchema: ZodSchemaWithInputMatchingOutput<
  Signatories<"immersion">
> = z.object({
  beneficiary: beneficiarySchema,
  establishmentRepresentative: establishmentRepresentativeSchema,
  beneficiaryRepresentative: beneficiaryRepresentativeSchema.optional(),
  beneficiaryCurrentEmployer: beneficiaryCurrentEmployerSchema.optional(),
});

const cciSignatoriesSchema: ZodSchemaWithInputMatchingOutput<
  Signatories<"mini-stage-cci">
> = z.object({
  beneficiary: studentBeneficiarySchema,
  establishmentRepresentative: establishmentRepresentativeSchema,
  beneficiaryRepresentative: beneficiaryRepresentativeSchema.optional(),
  beneficiaryCurrentEmployer: beneficiaryCurrentEmployerSchema.optional(),
});

export const immersionConventionSchema = conventionCommonSchema.extend({
  internshipKind: z.literal("immersion"),
  signatories: immersionSignatoriesSchema,
}) satisfies ZodSchemaWithInputMatchingOutput<
  ConventionCommon & ConventionInternshipKindSpecific<"immersion">
>;

export const miniStageConventionSchema = conventionCommonSchema.extend({
  internshipKind: z.literal("mini-stage-cci"),
  signatories: cciSignatoriesSchema,
}) satisfies ZodSchemaWithInputMatchingOutput<
  ConventionCommon & ConventionInternshipKindSpecific<"mini-stage-cci">
>;

// https://github.com/colinhacks/zod#discriminated-unions
export const conventionInternshipKindSpecificSchema: ZodSchemaWithInputMatchingOutput<
  ConventionInternshipKindSpecific<InternshipKind>
> = z.discriminatedUnion("internshipKind", [
  z.object({
    internshipKind: z.literal("immersion"),
    signatories: immersionSignatoriesSchema,
  }),
  z.object({
    internshipKind: z.literal("mini-stage-cci"),
    signatories: cciSignatoriesSchema,
  }),
]);

export const conventionSchema = z
  .discriminatedUnion("internshipKind", [
    immersionConventionSchema,
    miniStageConventionSchema,
  ])
  .check((ctx) => {
    if (
      !startDateIsBeforeEndDate({
        dateStart: ctx.value.dateStart,
        dateEnd: ctx.value.dateEnd,
      })
    ) {
      ctx.issues.push({
        input: {
          dateStart: ctx.value.dateStart,
          dateEnd: ctx.value.dateEnd,
        },
        code: "custom",
        message: localization.invalidDateStartDateEnd,
        path: [getConventionFieldName("dateEnd")],
        continue: true,
      });
    }
  })
  .check((ctx) => {
    if (
      !underMaxCalendarDuration({
        dateStart: ctx.value.dateStart,
        dateEnd: ctx.value.dateEnd,
        internshipKind: ctx.value.internshipKind,
      })
    ) {
      ctx.issues.push({
        input: {
          dateStart: ctx.value.dateStart,
          dateEnd: ctx.value.dateEnd,
        },
        code: "custom",
        ...getConventionTooLongMessageAndPath({
          internshipKind: ctx.value.internshipKind,
        }),
        continue: true,
      });
    }
  })
  .check((ctx) => {
    if (
      !underMaxPresenceDays({
        schedule: ctx.value.schedule,
        internshipKind: ctx.value.internshipKind,
        dateSubmission: ctx.value.dateSubmission,
      })
    ) {
      ctx.issues.push({
        input: {
          schedule: ctx.value.schedule,
          internshipKind: ctx.value.internshipKind,
          dateSubmission: ctx.value.dateSubmission,
        },
        code: "custom",
        ...getOverMaxWorkedDaysMessageAndPath({
          internshipKind: ctx.value.internshipKind,
          schedule: ctx.value.schedule,
          dateSubmission: ctx.value.dateSubmission,
        }),
        continue: true,
      });
    }
  })
  .check((ctx) => {
    if (
      !minorBeneficiaryHasRepresentative({
        dateStart: ctx.value.dateStart,
        signatories: ctx.value.signatories,
        dateSubmission: ctx.value.dateSubmission,
      })
    ) {
      const beneficiaryAgeAtConventionStart = getExactAge({
        birthDate: new Date(ctx.value.signatories.beneficiary.birthdate),
        referenceDate: new Date(ctx.value.dateStart),
      });
      ctx.issues.push({
        input: {
          dateStart: ctx.value.dateStart,
          dateSubmission: ctx.value.dateSubmission,
        },
        code: "custom",
        message: `Les bénéficiaires mineurs doivent renseigner un représentant légal. Le bénéficiaire aurait ${beneficiaryAgeAtConventionStart} ans au démarrage de la convention.`,
        path: [getConventionFieldName("signatories.beneficiaryRepresentative")],
        continue: true,
      });
    }
  })
  .superRefine((convention, issueMaker) => {
    const addIssue = (message: string, path: string) => {
      issueMaker.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [path],
      });
    };
    const beneficiaryAgeAtConventionStart = differenceInYears(
      new Date(convention.dateStart),
      new Date(convention.signatories.beneficiary.birthdate),
    );

    addIssuesIfDuplicateSignatoriesEmails(convention, addIssue);
    addIssuesIfDuplicateSignatoriesPhoneNumbers(convention, addIssue);
    addIssueIfDuplicateEmailsBetweenSignatoriesAndTutor(convention, addIssue);

    if (convention.internshipKind === "mini-stage-cci") {
      addIssueIfLimitedScheduleHoursExceeded(
        convention,
        addIssue,
        beneficiaryAgeAtConventionStart,
      );
      addIssueIfSundayIsInSchedule(
        addIssue,
        convention.id,
        convention.schedule.complexSchedule,
        convention.dateEnd,
      );
      if (
        !isConventionBeforeMiniStageFranceAddressReleaseDate(
          convention.dateSubmission,
        ) &&
        getCountryCodeFromAddress(convention.immersionAddress) !== "FR"
      )
        addIssue(
          localization.miniStageImmersionAddressMustBeInFrance,
          getConventionFieldName("immersionAddress"),
        );
    }

    addIssueIfAgeLessThanMinimumAge(
      addIssue,
      beneficiaryAgeAtConventionStart,
      ageRequirementByInternshipKind[convention.internshipKind],
    );

    addIssueIfAgeMoreThanMaximumAge(
      addIssue,
      beneficiaryAgeAtConventionStart,
      convention.dateSubmission,
      BENEFICIARY_MAXIMUM_AGE_REQUIREMENT,
    );

    const message = validateSchedule({
      dateEnd: convention.dateEnd,
      dateStart: convention.dateStart,
      id: convention.id,
      schedule: convention.schedule,
    });
    if (message) {
      addIssue(message, "schedule");
    }
  })
  .refine(mustBeSignedByEveryone, {
    message: localization.mustBeSignedByEveryone,
    path: [getConventionFieldName("status")],
  })
  .refine(validateBeneficiaryAddressAndParse, {
    message: localization.invalidBeneficiaryAddress,
    path: [getConventionFieldName("signatories.beneficiary.address")],
  }) satisfies ZodSchemaWithInputMatchingOutput<ConventionDto>;

export const conventionAssessmentFieldsSchema: ZodSchemaWithInputMatchingOutput<
  ConventionAssessmentFields["assessment"]
> = z
  .union([
    z.object({
      status: z.enum(assessmentStatuses),
      endedWithAJob: z.boolean(),
      signedAt: makeDateStringSchema().nullable(),
      createdAt: dateTimeIsoStringSchema,
    }),
    z.object({
      status: z.enum(legacyAssessmentStatuses),
      createdAt: dateTimeIsoStringSchema,
    }),
  ])
  .nullable();

const lastReminderDateByNotificationKindSchema: ZodSchemaWithInputMatchingOutput<LastReminderDateByNotificationKind> =
  z.object({
    email: dateTimeIsoStringSchema.nullable(),
    sms: dateTimeIsoStringSchema.nullable(),
  });

export const conventionLastRemindersSchema: ZodSchemaWithInputMatchingOutput<ConventionLastReminders> =
  z.object({
    conventionSignatures: z.record(
      z.enum(allSignatoryRoles),
      lastReminderDateByNotificationKindSchema,
    ),
    assessmentCompletion: lastReminderDateByNotificationKindSchema,
    assessmentSignature: lastReminderDateByNotificationKindSchema,
  });

export const agencyValidationStepSchema: ZodSchemaWithInputMatchingOutput<AgencyValidationStep> =
  z.enum(agencyValidationSteps);

export const conventionReadSchema: ZodSchemaWithInputMatchingOutput<ConventionReadDto> =
  conventionSchema.and(
    z
      .object({
        agencyName: agencyNameSchema,
        agencyDepartment: addressDepartmentCodeSchema,
        agencyKind: agencyKindSchema,
        agencyContactEmail: emailSchema,
        agencySiret: siretSchema,
        agencyValidationSteps: agencyValidationStepSchema,
        agencyRefersTo: z
          .object({
            id: refersToAgencyIdSchema,
            name: zStringMinLength1Max1024,
            contactEmail: emailSchema,
            kind: agencyKindSchema,
            siret: siretSchema,
          })
          .optional(),
        assessment: conventionAssessmentFieldsSchema,
        lastReminders: conventionLastRemindersSchema,
      })
      .and(withBannedEstablishmentInformationSchema),
  );

export const withConventionSchema: ZodSchemaWithInputMatchingOutput<WithConventionDto> =
  z.object({
    convention: conventionSchema,
  });

export const withConventionIdLegacySchema: ZodSchemaWithInputMatchingOutput<WithConventionIdLegacy> =
  z.object({
    id: conventionIdSchema,
  });

export const withConventionIdSchema: ZodSchemaWithInputMatchingOutput<WithConventionId> =
  z.object({
    conventionId: conventionIdSchema,
  });

export const updateConventionRequestSchema: ZodSchemaWithInputMatchingOutput<UpdateConventionRequestDto> =
  z.object({
    convention: conventionSchema,
  });

export const updateConventionStatusWithoutJustificationSchema: ZodSchemaWithInputMatchingOutput<UpdateConventionStatusWithoutJustification> =
  z.object({
    status: z.enum(updateConventionStatusWithoutJustificationTargetStatuses, {
      error: localization.invalidEnum,
    }),
    conventionId: conventionIdSchema,
  });

export const updateConventionStatusWithJustificationSchema: ZodSchemaWithInputMatchingOutput<UpdateConventionStatusWithJustification> =
  z.object({
    status: z.enum(unvalidatedConventionStatuses, {
      error: localization.invalidEnum,
    }),
    statusJustification: zStringMinLength1Max6000,
    conventionId: conventionIdSchema,
  });

export type WithFirstnameAndLastname = OmitFromExistingKeys<
  UpdateConventionStatusWithValidator,
  "conventionId" | "status"
>;

export const withFirstnameAndLastnameSchema: ZodSchemaWithInputMatchingOutput<WithFirstnameAndLastname> =
  z.object({
    firstname: firstnameSchema,
    lastname: lastnameSchema,
  });

const updateConventionStatusWithValidatorSchema: ZodSchemaWithInputMatchingOutput<UpdateConventionStatusWithValidator> =
  z
    .object({
      status: z.enum(conventionStatusesWithValidator, {
        error: localization.invalidEnum,
      }),
      conventionId: conventionIdSchema,
    })
    .and(withFirstnameAndLastnameSchema);

export const updateConventionStatusRequestSchema: ZodSchemaWithInputMatchingOutput<UpdateConventionStatusRequestDto> =
  z.union([
    updateConventionStatusWithJustificationSchema,
    updateConventionStatusWithValidatorSchema,
    updateConventionStatusWithoutJustificationSchema,
  ]);

export const renewConventionParamsSchema: ZodSchemaWithInputMatchingOutput<RenewConventionParams> =
  z
    .object({
      id: conventionIdSchema,
      dateStart: makeDateStringSchema(),
      dateEnd: makeDateStringSchema(),
      schedule: scheduleSchema,
      renewed: renewedSchema,
    })
    .superRefine((renewConventionParams, issueMaker) => {
      const addIssue = (message: string, path: string) => {
        issueMaker.addIssue({
          code: "custom",
          message,
          path: [path],
        });
      };

      const message = validateSchedule(renewConventionParams);
      if (message) {
        addIssue(message, "schedule");
      }
    });

export const generateMagicLinkRequestSchema: ZodSchemaWithInputMatchingOutput<GenerateMagicLinkRequestDto> =
  z.object({
    applicationId: conventionIdSchema,
    role: z.enum(allRoles, {
      error: localization.invalidEnum,
    }),
    expired: z.boolean(),
  });

export const transferConventionToAgencyRequestSchema: ZodSchemaWithInputMatchingOutput<TransferConventionToAgencyRequestDto> =
  z.object({
    conventionId: conventionIdSchema,
    agencyId: agencyIdSchema,
    justification: zStringMinLength1Max1024,
  });

export const markPartnersErroredConventionAsHandledRequestSchema: ZodSchemaWithInputMatchingOutput<MarkPartnersErroredConventionAsHandledRequest> =
  z.object({
    conventionId: conventionIdSchema,
  });

export const isConventionOld = (dateEnd: DateString) =>
  new Date(dateEnd).getTime() <= DATE_CONSIDERED_OLD.getTime();

const isConventionBeforeDistinctSignatoriesPhoneNumbersReleaseDate = (
  conventionSubimissionDate: DateString,
) =>
  new Date(conventionSubimissionDate).getTime() <=
  SIGNATORIES_PHONE_NUMBER_DISTINCT_RELEASE_DATE.getTime();

const isConventionBeforeMiniStageFranceAddressReleaseDate = (
  conventionSubmissionDate: DateString,
) =>
  new Date(conventionSubmissionDate).getTime() <
  CCI_FRENCH_ADDRESS_REQUIREMENT_RELEASE_DATE.getTime();

const getSignatoriesEntries = (convention: ConventionDto) =>
  signatoryKeys.flatMap((key) => {
    const signatory = convention.signatories[key];
    return signatory ? [{ key, signatory }] : [];
  });

const addIssuesIfDuplicateSignatoriesEmails = (
  convention: ConventionDto,
  addIssue: (message: string, path: string) => void,
) => {
  if (isConventionOld(convention.dateEnd)) return;
  const signatoriesWithEmail = getSignatoriesEntries(convention).map(
    ({ key, signatory }) => ({
      key,
      email: signatory.email,
    }),
  );
  signatoriesWithEmail.forEach((signatory) => {
    if (
      signatoriesWithEmail
        .filter((otherSignatory) => otherSignatory.key !== signatory.key)
        .some((otherSignatory) => otherSignatory.email === signatory.email)
    )
      addIssue(
        localization.signatoriesDistinctEmails,
        getConventionFieldName(`signatories.${signatory.key}.email`),
      );
  });
};

const addIssuesIfDuplicateSignatoriesPhoneNumbers = (
  convention: ConventionDto,
  addIssue: (message: string, path: string) => void,
) => {
  if (
    isConventionBeforeDistinctSignatoriesPhoneNumbersReleaseDate(
      convention.dateSubmission,
    )
  )
    return;
  const signatoriesWithPhoneNumber = getSignatoriesEntries(convention).map(
    ({ key, signatory }) => ({
      key,
      phoneNumber: signatory.phone,
    }),
  );
  signatoriesWithPhoneNumber.forEach((signatory) => {
    if (
      signatoriesWithPhoneNumber
        .filter((otherSignatory) => otherSignatory.key !== signatory.key)
        .some(
          (otherSignatory) =>
            otherSignatory.phoneNumber === signatory.phoneNumber,
        )
    )
      addIssue(
        localization.signatoriesDistinctPhoneNumbers,
        getConventionFieldName(`signatories.${signatory.key}.phone`),
      );
  });
};

const addIssueIfDuplicateEmailsBetweenSignatoriesAndTutor = (
  convention: ConventionDto,
  addIssue: (message: string, path: string) => void,
) => {
  if (
    !isTutorEmailDifferentThanBeneficiaryRelatedEmails(
      convention.signatories,
      convention.establishmentTutor,
    )
  )
    addIssue(
      localization.beneficiaryTutorEmailMustBeDistinct,
      getConventionFieldName("establishmentTutor.email"),
    );
};

const addIssueIfLimitedScheduleHoursExceeded = (
  convention: ConventionDto,
  addIssue: (message: string, path: string) => void,
  beneficiaryAgeAtConventionStart: number,
) => {
  const beneficiaryPrettyAge = Math.floor(beneficiaryAgeAtConventionStart);

  const miniStageRule = getMiniStageRule(
    beneficiaryAgeAtConventionStart,
    convention.dateSubmission,
  );
  if (!miniStageRule) {
    return addIssue(
      `Il n'y a pas de règle identifiée pour valider les horaires d'un mini stage créé le ${convention.dateSubmission} pour un bénéficiaire âgé de ${beneficiaryPrettyAge} ans.`,
      "schedule.totalHours",
    );
  }

  const weeklyHours = calculateWeeklyHoursFromSchedule(convention.schedule, {
    start: new Date(convention.dateStart),
    end: new Date(convention.dateEnd),
  });
  const dailyHours = calculateDailyHoursFromSchedule(convention.schedule, {
    start: new Date(convention.dateStart),
    end: new Date(convention.dateEnd),
  });

  if (
    weeklyHours.some(
      (weeklyHourSet) => weeklyHourSet > miniStageRule.maxWeeklyHours,
    )
  ) {
    addIssue(
      `La durée maximale hebdomadaire d'un mini-stage pour une personne de ${beneficiaryPrettyAge} ans est de ${miniStageRule.maxWeeklyHours}h`,
      getConventionFieldName("schedule.totalHours"),
    );
  }

  if (
    dailyHours.some(
      (dailyHour) =>
        miniStageRule.maxDailyHours && dailyHour > miniStageRule.maxDailyHours,
    )
  ) {
    addIssue(
      `La durée maximale journalière d'un mini-stage pour une personne de ${beneficiaryPrettyAge} ans est de ${miniStageRule.maxDailyHours}h`,
      getConventionFieldName("schedule.totalHours"),
    );
  }
};

const addIssueIfAgeLessThanMinimumAge = (
  addIssue: (message: string, path: string) => void,
  beneficiaryAgeAtConventionStart: number,
  miniumAgeRequirement: number,
) => {
  if (beneficiaryAgeAtConventionStart < miniumAgeRequirement)
    addIssue(
      `L'âge du bénéficiaire doit être au minimum de ${miniumAgeRequirement}ans`,
      getConventionFieldName("signatories.beneficiary.birthdate"),
    );
};

const addIssueIfAgeMoreThanMaximumAge = (
  addIssue: (message: string, path: string) => void,
  beneficiaryAgeAtConventionStart: number,
  dateSubmission: DateString,
  maximumAgeRequirement: number,
) => {
  const onlyCheckConventionsCreatedBeforeDate = new Date("2024-04-30");
  if (
    beneficiaryAgeAtConventionStart > maximumAgeRequirement &&
    new Date(dateSubmission) > onlyCheckConventionsCreatedBeforeDate
  )
    addIssue(
      `Merci de vérifier votre date de naissance: avez-vous ${beneficiaryAgeAtConventionStart} ans ?`,
      getConventionFieldName("signatories.beneficiary.birthdate"),
    );
};

const addIssueIfSundayIsInSchedule = (
  addIssue: (message: string, path: string) => void,
  conventionId: ConventionId,
  complexSchedule: DailyScheduleDto[],
  dateEnd: DateString,
) => {
  if (isConventionOld(dateEnd)) return;
  if (isSundayInSchedule(complexSchedule)) {
    addIssue(
      `[${conventionId}] Le mini-stage ne peut pas se dérouler un dimanche`,
      getConventionFieldName("schedule.workedDays"),
    );
  }
};

export const findSimilarConventionsParamsSchema: ZodSchemaWithInputMatchingOutput<FindSimilarConventionsParams> =
  z.object({
    siret: siretSchema,
    codeAppellation: appellationCodeSchema,
    dateStart: makeDateStringSchema(),
    beneficiaryBirthdate: makeDateStringSchema(),
    beneficiaryLastName: zStringMinLength1Max1024,
  });

export const findSimilarConventionsResponseSchema: ZodSchemaWithInputMatchingOutput<FindSimilarConventionsResponseDto> =
  z.object({
    similarConventionIds: z.array(conventionIdSchema),
  });

export const statusSchema = z.enum(conventionStatuses, {
  error: localization.invalidEnum,
});

const assessmentCompletionStatusFilterSchema = z.enum(
  assessmentCompletionStatusFilters,
  {
    error: localization.invalidEnum,
  },
);

const conventionAvailableSort = [
  "dateValidation",
  "dateStart",
  "dateSubmission",
  "dateEnd",
] as const;

export const flatGetConventionsForAgencyUserParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetConventionsForAgencyUserParams> =
  z.object({
    page: zToNumber.optional(),
    perPage: zToNumber.optional(),

    sortBy: z
      .enum(conventionAvailableSort, {
        error: localization.invalidEnum,
      })
      .optional(),
    sortDirection: z
      .enum(["asc", "desc"], {
        error: localization.invalidEnum,
      })
      .optional(),

    search: z.string().optional(),
    statuses: z.tuple([statusSchema], statusSchema).optional(),
    agencyIds: z.tuple([agencyIdSchema], agencyIdSchema).optional(),
    agencyDepartmentCodes: z.tuple([z.string()], z.string()).optional(),

    dateStartFrom: makeDateStringSchema().optional(),
    dateStartTo: makeDateStringSchema().optional(),
    dateEndFrom: makeDateStringSchema().optional(),
    dateEndTo: makeDateStringSchema().optional(),
    dateSubmissionFrom: makeDateStringSchema().optional(),
    dateSubmissionTo: makeDateStringSchema().optional(),

    assessmentCompletionStatus: z
      .tuple(
        [assessmentCompletionStatusFilterSchema],
        assessmentCompletionStatusFilterSchema,
      )
      .optional(),
  });

const withSortedConventionsSchema = withOptionalSortSchema(
  z.enum(conventionAvailableSort, {
    error: localization.invalidEnum,
  }),
);

export const getConventionsForAgencyUserParamsSchema: ZodSchemaWithInputMatchingOutput<GetConventionsForAgencyUserParams> =
  z
    .object({
      filters: z
        .object({
          search: z.string().optional(),
          actorEmailContains: z.string().optional(),
          establishmentNameContains: z.string().optional(),
          beneficiaryNameContains: z.string().optional(),
          statuses: z.tuple([statusSchema], statusSchema).optional(),
          agencyIds: z.tuple([agencyIdSchema], agencyIdSchema).optional(),
          agencyDepartmentCodes: z.tuple([z.string()], z.string()).optional(),
          dateStart: dateFilterSchema.optional(),
          dateEnd: dateFilterSchema.optional(),
          dateSubmission: dateFilterSchema.optional(),
          assessmentCompletionStatus: z
            .tuple(
              [assessmentCompletionStatusFilterSchema],
              assessmentCompletionStatusFilterSchema,
            )
            .optional(),
        })
        .optional(),
      pagination: paginationQueryParamsSchema.optional(),
    })
    .and(withSortedConventionsSchema);

export const paginatedConventionReadSchema =
  createPaginatedSchema(conventionReadSchema);
