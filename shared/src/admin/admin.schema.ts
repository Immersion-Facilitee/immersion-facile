import { z } from "zod";
import { agencyIdsSchema, agencyRoleSchema } from "../agency/agency.schema";
import { withEstablishmentBannishmentJustificationSchema } from "../establishment/bannedEstablishmentInformations.schema";
import { siretSchema } from "../siret/siret.schema";
import type { ZodSchemaWithInputMatchingOutput } from "../zodUtils";
import type {
  BanEstablishmentAdminForm,
  GetUsersFilters,
  ManageEstablishmentAdminForm,
  WithUserFilters,
} from "./admin.dto";

export const withUserFiltersSchema: ZodSchemaWithInputMatchingOutput<WithUserFilters> =
  z.object({
    agencyIds: agencyIdsSchema.optional(),
    agencyRole: agencyRoleSchema.optional(),
  });

export const manageEstablishmentAdminFormSchema: ZodSchemaWithInputMatchingOutput<ManageEstablishmentAdminForm> =
  z.object({
    siret: siretSchema,
  });

export const banEstablishmentAdminFormSchema: ZodSchemaWithInputMatchingOutput<BanEstablishmentAdminForm> =
  withEstablishmentBannishmentJustificationSchema;

export const getUsersFiltersSchema: ZodSchemaWithInputMatchingOutput<GetUsersFilters> =
  z.object({
    emailContains: z.string(),
  });
