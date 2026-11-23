import { z } from "zod";
import { agencyIdsSchema, agencyRoleSchema } from "../agency/agency.schema";
import { withEstablishmentBannishmentJustificationSchema } from "../establishment/bannedEstablishmentInformations.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  BanEstablishmentAdminForm,
  GetUsersFilters,
  WithUserFilters,
} from "./admin.dto";

export const withUserFiltersSchema: ZodSchemaWithInputMatchingOutput<WithUserFilters> =
  z.object({
    agencyIds: agencyIdsSchema.optional(),
    agencyRole: agencyRoleSchema.optional(),
  });

export const banEstablishmentAdminFormSchema: ZodSchemaWithInputMatchingOutput<BanEstablishmentAdminForm> =
  withEstablishmentBannishmentJustificationSchema;

export const getUsersFiltersSchema: ZodSchemaWithInputMatchingOutput<GetUsersFilters> =
  z.object({
    emailContains: z.string(),
  });
