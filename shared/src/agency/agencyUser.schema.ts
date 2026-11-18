import { z } from "zod";
import { emailSchema } from "../email/email.schema";
import { userIdSchema } from "../user/user.schema";
import { zStringMinLength1Max1024 } from "../utils/string.schema";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import { agencyIdSchema, agencyRoleSchema } from "./agency.schema";
import type {
  RejectConnectedUserRoleForAgencyParams,
  UserParamsForAgency,
  WithAgencyIdAndUserId,
} from "./agencyUser.dto";

export const withAgencyIdAndUserIdSchema: ZodSchemaWithInputMatchingOutput<WithAgencyIdAndUserId> =
  z.object({
    agencyId: agencyIdSchema,
    userId: userIdSchema,
  });

export const userParamsForAgencySchema: ZodSchemaWithInputMatchingOutput<UserParamsForAgency> =
  z.object({
    agencyId: agencyIdSchema,
    userId: userIdSchema,
    roles: z
      .array(agencyRoleSchema)
      .min(1, { message: localization.atLeastOneRole }),
    isNotifiedByEmail: z.boolean(),
    email: emailSchema,
  });

export const rejectIcUserRoleForAgencyParamsSchema: ZodSchemaWithInputMatchingOutput<RejectConnectedUserRoleForAgencyParams> =
  z.object({
    agencyId: agencyIdSchema,
    userId: userIdSchema,
    justification: zStringMinLength1Max1024,
  });
