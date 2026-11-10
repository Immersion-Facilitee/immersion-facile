import { z } from "zod";
import { agencyIdSchema, agencyKindSchema } from "../agency/agency.schema";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
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
import { agencyUserConventionListDtoSchema } from "./agencyUserConventionList.schema";
import {
  assessmentCompletionStatusFilterSchema,
  statusSchema,
} from "./convention.schema";

const adminConventionListDtoSchema: ZodSchemaWithInputMatchingOutput<AdminConventionListDto> =
  agencyUserConventionListDtoSchema.and(
    z.object({
      agencyKind: agencyKindSchema,
      agencyDepartmentName: z.string().nullable(),
      agencyRefersToAgencyName: z.string().nullable(),
    }),
  );

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
      sortBy: z
        .enum(["dateSubmission", "dateStart"], {
          error: localization.invalidEnum,
        })
        .optional(),
      search: textFilterSchema,
      agencyIds: z.tuple([agencyIdSchema], agencyIdSchema).optional(),
      statuses: z.tuple([statusSchema], statusSchema).optional(),
      assessmentCompletionStatus: z
        .tuple(
          [assessmentCompletionStatusFilterSchema],
          assessmentCompletionStatusFilterSchema,
        )
        .optional(),
      agencyNameContains: textFilterSchema,
      dateStartFrom: makeDateStringSchema().optional(),
      dateStartTo: makeDateStringSchema().optional(),
      dateValidationFrom: makeDateStringSchema().optional(),
      dateValidationTo: makeDateStringSchema().optional(),
    }),
  );
