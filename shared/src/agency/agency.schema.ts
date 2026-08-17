import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import { withAcquisitionSchema } from "../acquisition.dto";
import { addressSchema, departmentCodeSchema } from "../address/address.schema";
import type { Email } from "../email/email.dto";
import { emailSchema } from "../email/email.schema";
import { geoPositionSchema } from "../geoPosition/geoPosition.schema";
import { phoneNumberSchema } from "../phone/phone.schema";
import { allAgencyRoles } from "../role/role.dto";
import { searchTextAlphaNumericSchema } from "../search/searchText.schema";
import { siretSchema } from "../siret/siret.schema";
import { makeDateStringSchema } from "../utils/date";
import {
  stringWithMaxLength255,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zEnumValidation,
  zToNumber,
} from "../zodUtils";
import {
  type AgencyDto,
  type AgencyDtoForAgencyUsersAndAdmins,
  type AgencyId,
  type AgencyIdResponse,
  type AgencyKind,
  type AgencyOption,
  type AgencyStatus,
  activeAgencyStatuses,
  agencyKindFilters,
  allAgencyStatuses,
  type CloseAgencyAndTransferConventionsRequestDto,
  type CreateAgencyDto,
  type CreateAgencyInitialValues,
  closedOrRejectedAgencyStatuses,
  type DelegationAgencyInfo,
  type DelegationAgencyKind,
  delegationAgencyKindList,
  type ListAgencyOptionsRequestDto,
  maxAgencyOptionsPerRequest,
  orderedAgencyKindList,
  type PartnerAgencyKind,
  type PrivateListAgenciesRequestDto,
  partnerAgencyKindList,
  type WithAgencyId,
} from "./agency.dto";

export const agencyIdSchema: ZodSchemaWithInputMatchingOutput<AgencyId> =
  zStringMinLength1Max1024;
export const refersToAgencyIdSchema: ZodSchemaWithInputMatchingOutput<AgencyId> =
  z.string();
export const agencyIdsSchema: ZodSchemaWithInputMatchingOutput<AgencyId[]> = z
  .array(agencyIdSchema)
  .nonempty();

export const agencyRoleSchema = z.enum(allAgencyRoles, {
  error: localization.invalidEnum,
});

export const withAgencyIdSchema: ZodSchemaWithInputMatchingOutput<WithAgencyId> =
  z.object({
    agencyId: agencyIdSchema,
  });

export const withAgencyIdSchemaPartial: ZodSchemaWithInputMatchingOutput<
  Partial<WithAgencyId>
> = z
  .object({
    agencyId: agencyIdSchema,
  })
  .partial();

export const agencyIdResponseSchema: ZodSchemaWithInputMatchingOutput<AgencyIdResponse> =
  agencyIdSchema.optional();

export const agencyKindSchema: ZodSchemaWithInputMatchingOutput<AgencyKind> =
  zEnumValidation(
    orderedAgencyKindList,
    "Ce type de structure n'est pas supporté",
  );

export const partnerAgencyKindSchema: ZodSchemaWithInputMatchingOutput<PartnerAgencyKind> =
  zEnumValidation(
    partnerAgencyKindList,
    "Ce type de structure n'est pas supporté",
  );

const agencyStatusSchema = z.enum(allAgencyStatuses, {
  error: localization.invalidEnum,
});

export const agencyOptionSchema: ZodSchemaWithInputMatchingOutput<AgencyOption> =
  z.object({
    id: agencyIdSchema,
    name: z.string(),
    kind: agencyKindSchema,
    status: agencyStatusSchema,
    address: addressSchema,
    refersToAgencyName: zStringMinLength1Max1024.or(z.null()),
  });

export const agencyOptionsSchema: ZodSchemaWithInputMatchingOutput<
  AgencyOption[]
> = z.array(agencyOptionSchema);

const listAgencyOptionsLimitSchema: ZodSchemaWithInputMatchingOutput<number> =
  zToNumber
    .refine(Number.isInteger)
    .refine((limit) => limit > 0)
    .refine((limit) => limit <= maxAgencyOptionsPerRequest);

export const listAgencyOptionsRequestSchema: ZodSchemaWithInputMatchingOutput<ListAgencyOptionsRequestDto> =
  z.object({
    departmentCode: departmentCodeSchema.optional(),
    nameIncludes: searchTextAlphaNumericSchema.optional(),
    filterKind: z
      .enum(agencyKindFilters, {
        error: localization.invalidEnum,
      })
      .optional(),
    siret: siretSchema.optional(),
    status: z.array(agencyStatusSchema).optional(),
    limit: listAgencyOptionsLimitSchema.optional(),
  });

const delegationAgencyKindSchema: ZodSchemaWithInputMatchingOutput<DelegationAgencyKind> =
  z.enum(delegationAgencyKindList, {
    error: localization.invalidEnum,
  });

const delegationAgencyInfoSchema: ZodSchemaWithInputMatchingOutput<DelegationAgencyInfo> =
  z.object({
    delegationEndDate: makeDateStringSchema().nullable(),
    delegationAgencyName: z.string().nullable(),
    delegationAgencyKind: delegationAgencyKindSchema.nullable(),
  });

const withCounsellorsAndValidatorsEmailsSchema = z.object({
  counsellorEmails: z.array(emailSchema),
  validatorEmails: z.array(emailSchema),
});

const withCounsellorsAndRequiredValidatorEmailsSchema = z.object({
  counsellorEmails: z.array(emailSchema),
  validatorEmails: z.array(emailSchema).refine((emails) => emails.length > 0, {
    message: localization.atLeastOneEmail,
  }),
});

export const agencyNameSchema: ZodSchemaWithInputMatchingOutput<string> =
  stringWithMaxLength255;

const commonAgencyShape = {
  id: agencyIdSchema,
  createdAt: makeDateStringSchema(),
  name: agencyNameSchema,
  kind: agencyKindSchema,
  contactEmail: emailSchema,
  coveredDepartments: z.array(zStringMinLength1Max1024).min(1),
  address: addressSchema,
  position: geoPositionSchema,
  signature: stringWithMaxLength255,
  logoUrl: absoluteUrlSchema.or(z.null()),
  agencySiret: siretSchema,
  phoneNumber: phoneNumberSchema,
};

const mustHaveValidatorEmailsIfActiveOrNeedsReview = ({
  status,
  validatorEmails,
}: {
  status: AgencyStatus;
  validatorEmails: Email[];
}): boolean =>
  closedOrRejectedAgencyStatuses.includes(status) || validatorEmails.length > 0;

export const createAgencySchema: z.ZodType<
  CreateAgencyDto,
  CreateAgencyInitialValues
> = z
  .object(commonAgencyShape)
  .and(withCounsellorsAndRequiredValidatorEmailsSchema)
  .and(
    z.object({
      refersToAgencyId: refersToAgencyIdSchema.or(z.null()),
      refersToAgencyName: zStringMinLength1Max1024.or(z.null()),
      refersToAgencyContactEmail: emailSchema.or(z.null()),
      delegationAgencyInfo: delegationAgencyInfoSchema.or(z.null()),
    }),
  )
  .and(withAcquisitionSchema)
  .superRefine((createAgency, context) => {
    if (
      createAgency.refersToAgencyId &&
      !createAgency.counsellorEmails.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["counsellorEmails"],
        message:
          "Une structure d'accompagnement doit avoir au moins un email de conseiller pour examen préabable",
      });
    }
  })
  .refine(
    ({ validatorEmails }) =>
      mustHaveValidatorEmailsIfActiveOrNeedsReview({
        status: "needsReview",
        validatorEmails,
      }),
    {
      message: localization.atLeastOneEmail,
      path: ["validatorEmails"],
    },
  );

const mustHaveStatutJustificationIfClosedOrRejected = (
  agency: AgencyDto,
): boolean => {
  const agencyIsActiveOrInReview = [
    ...activeAgencyStatuses,
    "needsReview",
  ].includes(agency.status);
  const agencyIsNotActiveAndStatusJustificationIsFilled =
    closedOrRejectedAgencyStatuses.includes(agency.status) &&
    agency.statusJustification &&
    agency.statusJustification?.trim().length > 0;
  if (
    agencyIsActiveOrInReview ||
    agencyIsNotActiveAndStatusJustificationIsFilled
  ) {
    return true;
  }
  return false;
};

export const editAgencySchema: ZodSchemaWithInputMatchingOutput<AgencyDto> = z
  .object(commonAgencyShape)
  .and(withCounsellorsAndValidatorsEmailsSchema)
  .and(
    z.object({
      status: agencyStatusSchema,
      codeSafir: zStringMinLength1Max1024.or(z.null()),
      refersToAgencyId: refersToAgencyIdSchema.or(z.null()),
      refersToAgencyName: zStringMinLength1Max1024.or(z.null()),
      refersToAgencyContactEmail: emailSchema.or(z.null()),
      statusJustification: zStringMinLength1Max1024.or(z.null()),
      delegationAgencyInfo: delegationAgencyInfoSchema.or(z.null()),
    }),
  )
  .and(withAcquisitionSchema)
  .refine(mustHaveStatutJustificationIfClosedOrRejected, {
    message: "Une agence inactive doit avoir une justification",
    path: ["statusJustification"],
  })
  .refine(mustHaveValidatorEmailsIfActiveOrNeedsReview, {
    message: localization.atLeastOneEmail,
    path: ["validatorEmails"],
  });

const withAdminEmailsSchema: ZodSchemaWithInputMatchingOutput<{
  admins: Email[];
}> = z.object({
  admins: z.array(emailSchema),
});

export const agencyDtoForAgencyUsersAndAdminsSchema: ZodSchemaWithInputMatchingOutput<AgencyDtoForAgencyUsersAndAdmins> =
  z
    .object(commonAgencyShape)
    .merge(
      z.object({
        agencySiret: siretSchema,
        status: agencyStatusSchema,
        codeSafir: zStringMinLength1Max1024.or(z.null()),
        refersToAgencyId: refersToAgencyIdSchema.or(z.null()),
        refersToAgencyName: zStringMinLength1Max1024.or(z.null()),
        refersToAgencyContactEmail: emailSchema.or(z.null()),
        statusJustification: z.string().or(z.null()),
        delegationAgencyInfo: delegationAgencyInfoSchema.or(z.null()),
      }),
    )
    .and(withAcquisitionSchema)
    .and(withAdminEmailsSchema);

export const agencySchema: ZodSchemaWithInputMatchingOutput<AgencyDto> = z
  .object(commonAgencyShape)
  .extend({
    agencySiret: siretSchema,
    status: agencyStatusSchema,
    codeSafir: zStringMinLength1Max1024.or(z.null()),
    refersToAgencyId: refersToAgencyIdSchema.or(z.null()),
    refersToAgencyName: zStringMinLength1Max1024.or(z.null()),
    refersToAgencyContactEmail: emailSchema.or(z.null()),
    statusJustification: zStringMinLength1Max1024.or(z.null()),
    delegationAgencyInfo: delegationAgencyInfoSchema.or(z.null()),
  })
  .and(withCounsellorsAndValidatorsEmailsSchema)
  .and(withAcquisitionSchema)
  .refine(mustHaveStatutJustificationIfClosedOrRejected, {
    message: "Une agence inactive doit avoir une justification",
    path: ["statusJustification"],
  })
  .refine(mustHaveValidatorEmailsIfActiveOrNeedsReview, {
    message: localization.atLeastOneEmail,
    path: ["validatorEmails"],
  });

export const privateListAgenciesRequestSchema: ZodSchemaWithInputMatchingOutput<PrivateListAgenciesRequestDto> =
  z.object({
    status: agencyStatusSchema.optional(),
  });

export const closeAgencyAndTransferConventionsRequestSchema: ZodSchemaWithInputMatchingOutput<CloseAgencyAndTransferConventionsRequestDto> =
  z.object({
    agencyToCloseId: agencyIdSchema,
    agencyToTransferConventionsToId: agencyIdSchema,
  });
