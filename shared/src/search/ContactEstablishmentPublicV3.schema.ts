import { z } from "zod";
import { withAcquisitionSchema } from "../acquisition.dto";
import { immersionObjectiveSchema } from "../convention/convention.schema";
import { emailSchema } from "../email/email.schema";
import { contactModeSchema } from "../formEstablishment/FormEstablishment.schema";
import { phoneNumberSchema } from "../phone/phone.schema";
import { appellationCodeSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import { siretSchema } from "../siret/siret.schema";
import {
  firstnameMandatorySchema,
  lastnameMandatorySchema,
} from "../user/user.schema";
import {
  zStringMinLength1Max1024,
  zStringMinLength1Max6000,
} from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "../zodUtils";
import type { ContactEstablishmentPublicV3Dto } from "./ContactEstablishmentPublicV3.dto";

const contactInformationsCommonSchema = z.object({
  appellationCode: appellationCodeSchema,
  siret: siretSchema,
  potentialBeneficiaryFirstName: firstnameMandatorySchema,
  potentialBeneficiaryLastName: lastnameMandatorySchema,
  potentialBeneficiaryEmail: emailSchema,
  locationId: zUuidLike,
});

const contactEstablishmentPublicV3CommonSchema =
  contactInformationsCommonSchema.and(
    z.object({
      potentialBeneficiaryPhone: phoneNumberSchema,
      datePreferences: zStringMinLength1Max6000,
      contactMode: contactModeSchema,
    }),
  );

const contactEstablishmentPublicV3IFSchema =
  contactEstablishmentPublicV3CommonSchema.and(
    z.object({
      kind: z.literal("IF"),
      immersionObjective: immersionObjectiveSchema,
      experienceAdditionalInformation: zStringMinLength1Max1024.optional(),
      potentialBeneficiaryResumeLink: zStringMinLength1Max1024.optional(),
    }),
  );

const contactEstablishmentPublicV31Eleve1StageSchema =
  contactEstablishmentPublicV3CommonSchema.and(
    z.object({
      kind: z.literal("1_ELEVE_1_STAGE"),
      immersionObjective: z.literal(
        "Découvrir un métier ou un secteur d'activité",
      ),
      levelOfEducation: z.enum(["3ème", "2nde"], {
        error: localization.invalidEnum,
      }),
    }),
  );

export const contactEstablishmentPublicV3Schema: ZodSchemaWithInputMatchingOutput<ContactEstablishmentPublicV3Dto> =
  contactEstablishmentPublicV3IFSchema
    .or(contactEstablishmentPublicV31Eleve1StageSchema)
    .and(withAcquisitionSchema);
