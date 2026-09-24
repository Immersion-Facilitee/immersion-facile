import z from "zod";
import { businessNameSchema } from "../establishment/businessComponents.schema";
import type {
  BusinessName,
  BusinessNameCustomized,
} from "../establishment/establishment.dto";
import type {
  DataWithPagination,
  PaginationQueryParams,
} from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import type { DateString } from "../utils/date";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  ConventionAssessmentFields,
  ConventionId,
  ConventionStatus,
} from "./convention.dto";
import {
  conventionAssessmentFieldsSchema,
  conventionDateEndSchema,
  conventionDateStartSchema,
  conventionIdSchema,
  conventionStatusSchema,
} from "./convention.schema";

export type BeneficiaryConvention = {
  conventionId: ConventionId;
  businessName: BusinessName | BusinessNameCustomized;
  status: ConventionStatus;
  assessment: ConventionAssessmentFields["assessment"];
  dateStart: DateString;
  dateEnd: DateString;
};

const beneficiaryConventionSchema: ZodSchemaWithInputMatchingOutput<BeneficiaryConvention> =
  z.object({
    conventionId: conventionIdSchema,
    businessName: businessNameSchema,
    status: conventionStatusSchema,
    assessment: conventionAssessmentFieldsSchema,
    dateStart: conventionDateStartSchema,
    dateEnd: conventionDateEndSchema,
  });

export type FlatGetBeneficiaryConventionListParams = PaginationQueryParams & {
  search?: string;
};

export type GetBeneficiaryConventionListParams = {
  filters?: {
    search?: string;
  };
  pagination?: PaginationQueryParams;
};

export type BeneficiaryConventionListDto =
  DataWithPagination<BeneficiaryConvention>;

export const flatGetBeneficiaryConventionListParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetBeneficiaryConventionListParams> =
  paginationQueryParamsSchema.and(
    z.object({
      search: z.string().optional(),
    }),
  );

export const getBeneficiaryConventionListParamsSchema: ZodSchemaWithInputMatchingOutput<GetBeneficiaryConventionListParams> =
  z.object({
    filters: z
      .object({
        search: z.string().optional(),
      })
      .optional(),
    pagination: paginationQueryParamsSchema.optional(),
  });

export const beneficiaryConventionListDtoSchema: ZodSchemaWithInputMatchingOutput<BeneficiaryConventionListDto> =
  createPaginatedSchema(beneficiaryConventionSchema);

export const flatParamsToGetBeneficiaryConventionListParams = (
  flatParams: FlatGetBeneficiaryConventionListParams,
): GetBeneficiaryConventionListParams => {
  const { search, page, perPage, ...rest } = flatParams;

  rest satisfies Record<string, never>;

  return {
    filters: {
      search,
    },
    pagination: {
      page,
      perPage,
    },
  };
};
