import { z } from "zod";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import { siretSchema } from "../siret/siret.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type AdminAgencyListItemDto,
  adminAgencyListSearchMinLength,
  type GetAgenciesForAdminParams,
} from "./adminAgencyList.dto";
import {
  agencyIdSchema,
  agencyKindSchema,
  agencyStatusSchema,
} from "./agency.schema";

const adminAgencyListItemSchema: ZodSchemaWithInputMatchingOutput<AdminAgencyListItemDto> =
  z.object({
    id: agencyIdSchema,
    name: z.string(),
    kind: agencyKindSchema,
    status: agencyStatusSchema,
    siret: siretSchema,
    refersToAgencyName: z.string().nullable(),
  });

export const paginatedAdminAgencyListSchema: ZodSchemaWithInputMatchingOutput<
  DataWithPagination<AdminAgencyListItemDto>
> = createPaginatedSchema(adminAgencyListItemSchema);

export const getAgenciesForAdminParamsSchema: ZodSchemaWithInputMatchingOutput<GetAgenciesForAdminParams> =
  paginationQueryParamsSchema.and(
    z.object({
      search: z
        .string()
        .trim()
        .min(
          adminAgencyListSearchMinLength,
          localization.minCharacters(adminAgencyListSearchMinLength),
        )
        .optional(),
      kinds: z.tuple([agencyKindSchema], agencyKindSchema).optional(),
      statuses: z.tuple([agencyStatusSchema], agencyStatusSchema).optional(),
    }),
  );
