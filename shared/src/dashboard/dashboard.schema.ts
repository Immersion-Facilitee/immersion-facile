import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  adminDashboardNames,
  allDashboardNames,
  type DashboardUrlAndName,
  type GetAdminDashboardParams,
  type GetConventionMagicLinkDashboardParams,
} from "./dashboard.dto";

export const getAdminDashboardParamsSchema: ZodSchemaWithInputMatchingOutput<GetAdminDashboardParams> =
  z.object({
    name: z.enum(adminDashboardNames, {
      error: localization.invalidEnum,
    }),
  });

export const getConventionMagicLinkDashboardParamsSchema: ZodSchemaWithInputMatchingOutput<GetConventionMagicLinkDashboardParams> =
  z.object({
    name: z.enum(["conventionStatus"], {
      error: localization.invalidEnum,
    }),
    conventionId: z.string(),
  });

export const getDashboardParams = z.union([
  getAdminDashboardParamsSchema,
  getConventionMagicLinkDashboardParamsSchema,
]);

export const dashboardUrlAndNameSchema: ZodSchemaWithInputMatchingOutput<DashboardUrlAndName> =
  z.object({
    name: z.enum(allDashboardNames, {
      error: localization.invalidEnum,
    }),
    url: absoluteUrlSchema,
  });
