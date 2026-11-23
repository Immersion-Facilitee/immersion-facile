import { z } from "zod";
import type { DataWithPagination } from "../pagination/pagination.dto";
import {
  createPaginatedSchema,
  paginationQueryParamsSchema,
} from "../pagination/pagination.schema";
import { siretSchema } from "../siret/siret.schema";
import { dateTimeIsoStringSchema } from "../utils/date";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  type AdminEstablishmentListItemDto,
  adminEstablishmentListSearchMinLength,
  type GetEstablishmentsForAdminParams,
} from "./adminEstablishmentList.dto";

const adminEstablishmentListItemSchema: ZodSchemaWithInputMatchingOutput<AdminEstablishmentListItemDto> =
  z.object({
    siret: siretSchema,
    name: z.string(),
    customizedName: z.string().nullable(),
    city: z.string(),
    postcode: z.string(),
    otherLocationsCount: z.number().int().nonnegative(),
    createdAt: dateTimeIsoStringSchema,
    updatedAt: dateTimeIsoStringSchema,
    discussionsCount: z.number().int().nonnegative(),
    validatedConventionsCount: z.number().int().nonnegative(),
  });

export const paginatedAdminEstablishmentListSchema: ZodSchemaWithInputMatchingOutput<
  DataWithPagination<AdminEstablishmentListItemDto>
> = createPaginatedSchema(adminEstablishmentListItemSchema);

export const getEstablishmentsForAdminParamsSchema: ZodSchemaWithInputMatchingOutput<GetEstablishmentsForAdminParams> =
  paginationQueryParamsSchema.and(
    z.object({
      search: z
        .string()
        .trim()
        .min(
          adminEstablishmentListSearchMinLength,
          localization.minCharacters(adminEstablishmentListSearchMinLength),
        )
        .optional(),
    }),
  );
