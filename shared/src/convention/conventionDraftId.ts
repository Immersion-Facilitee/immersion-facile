import z from "zod";
import type { Flavor } from "../typeFlavors";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";

export type ConventionDraftId = Flavor<string, "ConventionDraftId">;
export type WithConventionDraftId = {
  conventionDraftId: ConventionDraftId;
};

export const conventionDraftIdSchema: ZodSchemaWithInputMatchingOutput<ConventionDraftId> =
  z.uuid(localization.invalidUuid);
