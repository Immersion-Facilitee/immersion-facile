import { z } from "zod";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import type {
  FtConnectIdentity,
  FtConnectIdentityWithoutToken,
  FtConnectImmersionAdvisorDto,
  WithFtConnectAdvisorForBeneficiary,
} from "./federatedIdentity.dto";

const ftConnectImmersionAdvisorSchema: ZodSchemaWithInputMatchingOutput<FtConnectImmersionAdvisorDto> =
  z.object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    type: z.enum(["PLACEMENT", "CAPEMPLOI"], {
      error: localization.invalidEnum,
    }),
  });

const withFtConnectImmersionAdvisorSchema: ZodSchemaWithInputMatchingOutput<
  WithFtConnectAdvisorForBeneficiary | undefined
> = z
  .object({
    advisor: ftConnectImmersionAdvisorSchema.optional(),
  })
  .optional();

export const ftConnectIdentitySchema: ZodSchemaWithInputMatchingOutput<FtConnectIdentity> =
  z.object({
    provider: z.literal("ftConnect"),
    token: z.string(),
    payload: withFtConnectImmersionAdvisorSchema,
  });

export const ftConnectIdentityWithoutTokenSchema: ZodSchemaWithInputMatchingOutput<FtConnectIdentityWithoutToken> =
  z.object({
    provider: z.literal("ftConnect"),
    payload: withFtConnectImmersionAdvisorSchema,
  });
