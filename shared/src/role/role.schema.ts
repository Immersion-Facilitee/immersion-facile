import { z } from "zod";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import {
  allRoles,
  allSignatoryRoles,
  type ConventionActorRole,
  conventionActorRoles,
  type EstablishmentRole,
  establishmentsRoles,
  type Role,
  type SignatoryRole,
} from "./role.dto";

export const roleSchema: ZodSchemaWithInputMatchingOutput<Role> = z.enum(
  allRoles,
  {
    error: localization.invalidEnum,
  },
);

export const conventionActorRoleSchema: ZodSchemaWithInputMatchingOutput<ConventionActorRole> =
  z.enum(conventionActorRoles, {
    error: localization.invalidEnum,
  });

export const signatoryRoleSchema: ZodSchemaWithInputMatchingOutput<SignatoryRole> =
  z.enum(allSignatoryRoles, {
    error: localization.invalidEnum,
  });

export const establishmentRoleSchema: ZodSchemaWithInputMatchingOutput<EstablishmentRole> =
  z.enum(establishmentsRoles, {
    error: localization.invalidEnum,
  });
