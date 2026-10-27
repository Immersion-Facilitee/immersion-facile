import { z } from "zod";
import { agencyKindSchema } from "../agency/agency.schema";
import { emailSchema } from "../email/email.schema";
import { businessNameSchema } from "../establishment/businessComponents.schema";
import { ftConnectIdentityWithoutTokenSchema } from "../federatedIdentities/federatedIdentity.schema";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import { appellationAndRomeDtoSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import { siretSchema } from "../siret/siret.schema";
import {
  firstnameMandatorySchema,
  lastnameMandatorySchema,
} from "../user/user.schema";
import { makeDateStringSchema } from "../utils/date";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type AdminConventionListDto,
  adminConventionListTextFilterMinLength,
  type FlatGetConventionsForAdminParams,
} from "./adminConventionList.dto";
import {
  conventionDateEndSchema,
  conventionDateStartSchema,
  conventionIdSchema,
  conventionStatusSchema,
  statusSchema,
} from "./convention.schema";
import { conventionDraftIdSchema } from "./conventionDraftId";

export const adminConventionListDtoSchema: ZodSchemaWithInputMatchingOutput<AdminConventionListDto> =
  z.object({
    id: conventionIdSchema,
    sourceConventionDraftId: conventionDraftIdSchema.optional(),
    status: conventionStatusSchema,
    dateSubmission: makeDateStringSchema(),
    agency: z.object({
      name: z.string(),
      kind: agencyKindSchema,
      refersToAgencyName: z.string().nullable(),
      departmentName: z.string().nullable(),
    }),
    businessName: businessNameSchema,
    siret: siretSchema,
    immersionAppellation: appellationAndRomeDtoSchema,
    dateStart: conventionDateStartSchema,
    dateEnd: conventionDateEndSchema,
    beneficiary: z.object({
      firstName: firstnameMandatorySchema,
      lastName: lastnameMandatorySchema,
      federatedIdentity: ftConnectIdentityWithoutTokenSchema.optional(),
    }),
  });

export const paginatedAdminConventionListSchema: ZodSchemaWithInputMatchingOutput<
  DataWithPagination<AdminConventionListDto>
> = createPaginatedSchema(adminConventionListDtoSchema);

const textFilterSchema = z
  .string()
  .trim()
  .min(
    adminConventionListTextFilterMinLength,
    localization.minCharacters(adminConventionListTextFilterMinLength),
  )
  .optional();

export const flatGetConventionsForAdminParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetConventionsForAdminParams> =
  paginationQueryParamsSchema.and(
    z.object({
      statuses: z.tuple([statusSchema], statusSchema).optional(),
      agencyNameContains: textFilterSchema,
      beneficiaryEmail: emailSchema.optional(),
      beneficiaryNameContains: textFilterSchema,
      beneficiaryRepresentativeEmail: emailSchema.optional(),
      establishmentTutorEmail: emailSchema.optional(),
      establishmentRepresentativeEmail: emailSchema.optional(),
      businessNameContains: textFilterSchema,
      siret: siretSchema.optional(),
      dateStartFrom: makeDateStringSchema().optional(),
      dateStartTo: makeDateStringSchema().optional(),
      dateValidationFrom: makeDateStringSchema().optional(),
      dateValidationTo: makeDateStringSchema().optional(),
    }),
  );
