import {
  immersionFranceTravailAdvisors,
  localization,
  makezTrimmedString,
  type ZodSchemaWithInputMatchingOutput,
  zUuidLike,
} from "shared";
import { z } from "zod";
import type { ConventionFtUserAdvisorDto } from "../dto/FtConnect.dto";

export const conventionFranceTravailUserAdvisorDtoSchema: ZodSchemaWithInputMatchingOutput<ConventionFtUserAdvisorDto> =
  z.object({
    advisor: z
      .object({
        firstName: makezTrimmedString(
          "Le prénom du conseiller ne peut pas être vide",
        ),
        lastName: makezTrimmedString(
          "Le nom du conseiller ne peut pas être vide",
        ),
        email: z.email({
          error: "L'email du conseiller est invalide",
        }),
        type: z.enum(immersionFranceTravailAdvisors, {
          error: localization.invalidEnum,
        }),
      })
      .optional(),
    ftExternalId: zUuidLike,
    conventionId: z.uuid(),
  });
