import { z } from "zod";
import { businessNameSchema } from "../establishment/businessComponents.schema";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import { appellationAndRomeDtoSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import {
  firstnameMandatorySchema,
  lastnameMandatorySchema,
} from "../user/user.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import {
  conventionAssessmentFieldsSchema,
  conventionDateEndSchema,
  conventionDateStartSchema,
  conventionIdSchema,
  conventionStatusSchema,
} from "./convention.schema";
import type {
  EstablishmentUserConventionListDto,
  FlatGetConventionsForEstablishmentUserParams,
} from "./establishmentUserConventionList.dto";

export const establishmentUserConventionListDtoSchema: ZodSchemaWithInputMatchingOutput<EstablishmentUserConventionListDto> =
  z.object({
    id: conventionIdSchema,
    status: conventionStatusSchema,
    dateStart: conventionDateStartSchema,
    dateEnd: conventionDateEndSchema,
    businessName: businessNameSchema,
    immersionAppellation: appellationAndRomeDtoSchema,
    assessment: conventionAssessmentFieldsSchema,
    beneficiary: z.object({
      firstName: firstnameMandatorySchema,
      lastName: lastnameMandatorySchema,
    }),
  });

export const paginatedEstablishmentUserConventionListSchema: ZodSchemaWithInputMatchingOutput<
  DataWithPagination<EstablishmentUserConventionListDto>
> = createPaginatedSchema(establishmentUserConventionListDtoSchema);

export const flatGetConventionsForEstablishmentUserParamsSchema: ZodSchemaWithInputMatchingOutput<FlatGetConventionsForEstablishmentUserParams> =
  paginationQueryParamsSchema.and(
    z.object({
      search: z.string().optional(),
    }),
  );
