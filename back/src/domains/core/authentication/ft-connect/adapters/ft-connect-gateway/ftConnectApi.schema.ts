import {
  emailSchema,
  ftAdvisorKinds,
  localization,
  makeDateStringSchema,
  type ZodSchemaWithInputMatchingOutput,
  zStringMinLength1Max1024,
} from "shared";
import { z } from "zod";
import type { BearerToken } from "../../dto/BearerToken";
import type { FtConnectAdvisorsKind } from "../../dto/FtConnectAdvisor.dto";
import type {
  ExternalFtConnectAdvisor,
  ExternalFtConnectBirthDate,
  ExternalFtConnectContactDetails,
  ExternalFtConnectStatut,
  ExternalFtConnectUser,
  FtConnectHeaders,
} from "./ftConnectApi.dto";

export const externalFtConnectUserSchema: ZodSchemaWithInputMatchingOutput<ExternalFtConnectUser> =
  z.object({
    email: emailSchema.optional(),
    family_name: zStringMinLength1Max1024,
    gender: z.enum(["male", "female"], {
      error: localization.invalidEnum,
    }),
    given_name: zStringMinLength1Max1024,
    idIdentiteExterne: zStringMinLength1Max1024,
    sub: zStringMinLength1Max1024,
  });

export const externalFtConnectUserStatutSchema: ZodSchemaWithInputMatchingOutput<ExternalFtConnectStatut> =
  z.object({
    codeStatutIndividu: z.enum(["0", "1"], {
      error: localization.invalidEnum,
    }),
    libelleStatutIndividu: z.enum(
      ["Non demandeur d’emploi", "Demandeur d’emploi"],
      {
        error: localization.invalidEnum,
      },
    ),
  });

const ftAdvisorKindSchema: ZodSchemaWithInputMatchingOutput<FtConnectAdvisorsKind> =
  z.enum(ftAdvisorKinds, {
    error: localization.invalidEnum,
  });

const externalftConnectAdvisorSchema: ZodSchemaWithInputMatchingOutput<ExternalFtConnectAdvisor> =
  z.object({
    nom: zStringMinLength1Max1024,
    prenom: zStringMinLength1Max1024,
    civilite: z.enum(["1", "2"], {
      error: localization.invalidEnum,
    }),
    mail: emailSchema,
    type: ftAdvisorKindSchema,
  });

export const externalFtConnectAdvisorsSchema: ZodSchemaWithInputMatchingOutput<
  ExternalFtConnectAdvisor[]
> = z.array(externalftConnectAdvisorSchema);

export const externalFtConnectBirthDateSchema: ZodSchemaWithInputMatchingOutput<ExternalFtConnectBirthDate> =
  z.object({
    dateDeNaissance: makeDateStringSchema(),
  });

export const externalFtConnectContactDetailsSchema: ZodSchemaWithInputMatchingOutput<ExternalFtConnectContactDetails> =
  z.object({
    adresse1: z.string().optional(),
    adresse2: z.string().optional(),
    adresse3: z.string().optional(),
    adresse4: z.string().optional(),
    codePostal: z.string().optional(),
    codeINSEE: z.string().optional(),
    libelleCommune: z.string().optional(),
    codePays: z.string().optional(),
    libellePays: z.string().optional(),
    nom: zStringMinLength1Max1024,
    prenom: zStringMinLength1Max1024,
    email: emailSchema,
    telephone1: z.string().optional(),
    telephone2: z.string().optional(),
    statutValidationEmail: zStringMinLength1Max1024,
  });

const bearerSchema = z
  .string()
  .regex(/^Bearer .+$/) as ZodSchemaWithInputMatchingOutput<BearerToken>;

export const ftConnectHeadersSchema: ZodSchemaWithInputMatchingOutput<FtConnectHeaders> =
  z
    .object({
      "Content-Type": z.literal("application/json"),
      Accept: z.literal("application/json"),
      Authorization: bearerSchema,
    })
    .loose();
