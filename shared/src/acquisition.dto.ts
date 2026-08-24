import { z } from "zod";
import type { ZodSchemaWithInputMatchingOutput } from "./zodUtils";

export type WithAcquisition = {
  acquisitionCampaign?: string | undefined;
  acquisitionKeyword?: string | undefined;
  acquisitionMedium?: string | undefined;
};

export const withAcquisitionShape = {
  acquisitionCampaign: z.string().optional(),
  acquisitionKeyword: z.string().optional(),
  acquisitionMedium: z.string().optional(),
};

export const withAcquisitionSchema: ZodSchemaWithInputMatchingOutput<WithAcquisition> =
  z.object(withAcquisitionShape);
