import { uniq } from "ramda";
import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import { withAcquisitionSchema } from "../acquisition.dto";
import { addressAndPositionSchema } from "../address/address.schema";
import { emailSchema } from "../email/email.schema";
import { withBannedEstablishmentInformationSchema } from "../establishment/bannedEstablishmentInformations.schema";
import { businessNameSchema } from "../establishment/businessComponents.schema";
import { nafSchema } from "../naf/naf.schema";
import { phoneNumberSchema } from "../phone/phone.schema";
import { withRemoteWorkModeSchema } from "../remoteWorkMode/remoteWorkMode.schema";
import type { EstablishmentRole } from "../role/role.dto";
import { establishmentRoleSchema } from "../role/role.schema";
import { appellationAndRomeDtoSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import { siretSchema } from "../siret/siret.schema";
import type { NotEmptyArray } from "../utils";
import { dateTimeIsoStringSchema } from "../utils/date";
import { frenchEstablishmentKinds } from "../utils/establishment";
import { addressWithPostalCodeSchema } from "../utils/postalCode";
import {
  zStringCanBeEmpty,
  zStringCanBeEmptyMax9200,
  zStringMinLength1Max8,
  zStringMinLength1Max255,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zBoolean,
  zEnumValidation,
} from "../zodUtils";
import type {
  ContactMode,
  CSVBoolean,
  EstablishmentBatchReport,
  EstablishmentCSVRow,
  EstablishmentFormOffer,
  EstablishmentUserRightStatus,
  FormEstablishmentBatchDto,
  FormEstablishmentDto,
  FormEstablishmentSource,
  FormEstablishmentUserRight,
  SiretAdditionFailure,
  WithFormEstablishmentDto,
} from "./FormEstablishment.dto";
import {
  establishmentUserRightStatuses,
  fitForDisabledWorkersOptions,
} from "./FormEstablishment.dto";

export const defaultMaxContactsPerMonth = 6;
export const noContactPerMonth = 0;

const makeOnlyTargetRoleAndAcceptedStatus =
  (role: EstablishmentRole) =>
  (statusAndRole: {
    status: EstablishmentUserRightStatus;
    role: EstablishmentRole;
  }): boolean => {
    return statusAndRole.role === role && statusAndRole.status === "ACCEPTED";
  };

export const onlyAdminUserRightsWithStatusAccepted =
  makeOnlyTargetRoleAndAcceptedStatus("establishment-admin");
export const onlyContactUserRightsWithStatusAccepted =
  makeOnlyTargetRoleAndAcceptedStatus("establishment-contact");

export const onlyUserRightWithStatusAccepted = ({
  status,
}: {
  status: EstablishmentUserRightStatus;
}) => status === "ACCEPTED";

const contactModesWithoutWelcomeAddress: NotEmptyArray<ContactMode> = [
  "EMAIL",
  "PHONE",
];

const contactModesWithWelcomeAddress: NotEmptyArray<ContactMode> = [
  "IN_PERSON",
];

const validContactModes: NotEmptyArray<ContactMode> = [
  ...contactModesWithoutWelcomeAddress,
  ...contactModesWithWelcomeAddress,
];
export const contactModeSchema = zEnumValidation(
  validContactModes,
  "Choisissez parmi les options proposées",
);

export const formEstablishmentUserRightStatusSchema = zEnumValidation(
  establishmentUserRightStatuses,
  "Le statut est inconnu",
);

const establishmentContactBaseSchema = z.object({
  role: z.literal("establishment-contact"),
  status: formEstablishmentUserRightStatusSchema,
  email: emailSchema,
  firstName: zStringMinLength1Max255.optional(),
  lastName: zStringMinLength1Max255.optional(),
  shouldReceiveDiscussionNotifications: zBoolean,
  job: zStringMinLength1Max255.optional(),
  isMainContactInPerson: zBoolean.optional(),
});

const establishmentContactPhoneSchema = z.object({
  phone: phoneNumberSchema.optional(),
  isMainContactByPhone: zBoolean.optional(),
});

const establishmentContactSchema = establishmentContactBaseSchema.extend(
  establishmentContactPhoneSchema.shape,
);

const establishmentAdminSchema = z.object({
  role: z.literal("establishment-admin"),
  status: formEstablishmentUserRightStatusSchema,
  email: emailSchema,
  firstName: zStringMinLength1Max255.optional(),
  lastName: zStringMinLength1Max255.optional(),
  phone: phoneNumberSchema,
  isMainContactByPhone: zBoolean,
  isMainContactInPerson: zBoolean.optional(),
  shouldReceiveDiscussionNotifications: zBoolean,
  job: zStringMinLength1Max255,
});

export const formEstablishmentUserRightSchema: ZodSchemaWithInputMatchingOutput<FormEstablishmentUserRight> =
  z.discriminatedUnion("role", [
    establishmentAdminSchema,
    establishmentContactSchema,
  ]);

export const establishmentFormOfferSchema: ZodSchemaWithInputMatchingOutput<EstablishmentFormOffer> =
  appellationAndRomeDtoSchema.and(withRemoteWorkModeSchema);

export const formEstablishmentPendingUserRightSchema =
  formEstablishmentUserRightSchema.and(
    z.object({
      status: z.literal("PENDING"),
    }),
  );

export const formEstablishmentUserRightsSchema: ZodSchemaWithInputMatchingOutput<
  FormEstablishmentUserRight[]
> = z
  .array(formEstablishmentUserRightSchema)
  .refine(
    (userRights) =>
      userRights.filter(onlyAdminUserRightsWithStatusAccepted).length > 0,
    "La structure accueillante nécessite au moins un administrateur pour être valide.",
  )
  .refine(
    (userRights) =>
      uniq(userRights.map((right) => right.email)).length === userRights.length,
    "La structure accueillante ne peut pas avoir plusieurs droits pour la même personne.",
  )
  .refine(
    (userRights) =>
      userRights.some(
        (right) =>
          right.shouldReceiveDiscussionNotifications &&
          right.status === "ACCEPTED",
      ),
    "La structure accueillante nécessite au moins qu'une personne reçoive les notifications liées aux candidatures.",
  );

const formEstablishmentSources: NotEmptyArray<FormEstablishmentSource> = [
  "immersion-facile",
  "cci",
  "cma",
  "lesentreprises-sengagent",
  "unJeuneUneSolution",
  "passeEmploi",
];
export const formEstablishmentSourceSchema = z.enum(formEstablishmentSources, {
  error: localization.invalidEnum,
});

export const fitForDisabledWorkersSchema = z.enum(fitForDisabledWorkersOptions);

const formEstablishmentCommonShape = {
  offers: z
    .array(establishmentFormOfferSchema)
    .min(1, localization.atLeastOneJob),
  source: formEstablishmentSourceSchema,
  siret: siretSchema,
  businessName: businessNameSchema,
  businessNameCustomized: zStringMinLength1Max255
    .refine(
      (s) => !frenchEstablishmentKinds.includes(s.toUpperCase()),
      "Le nom sous lequel vous souhaitez apparaitre dans les résultats de recherche ne peut pas être la raison sociale seule",
    )
    .optional(),
  website: absoluteUrlSchema.or(z.literal("")).optional(),
  additionalInformation: zStringCanBeEmptyMax9200.optional(),
  businessAddresses: z
    .array(
      z.object({
        id: zUuidLike,
        rawAddress: addressWithPostalCodeSchema,
      }),
    )
    .min(1),
  isEngagedEnterprise: zBoolean.optional(),
  fitForDisabledWorkers: fitForDisabledWorkersSchema,
  naf: nafSchema.optional(),

  userRights: formEstablishmentUserRightsSchema,
  maxContactsPerMonth: z
    .number({
      error:
        "Veuillez renseigner le nombre maximum de mise en contact par semaine que vous souhaitez recevoir",
    })
    .nonnegative({
      message: "La valeur renseignée ne peut pas être négative",
    })
    .int({
      message: "La valeur renseignée ne peut pas contenir de décimale",
    }),
  nextAvailabilityDate: dateTimeIsoStringSchema.optional(),
  searchableBy: z.object({
    students: zBoolean,
    jobSeekers: zBoolean,
  }),
};

export const formEstablishmentSchema: ZodSchemaWithInputMatchingOutput<FormEstablishmentDto> =
  z
    .discriminatedUnion("contactMode", [
      z.object({
        contactMode: z.enum(contactModesWithoutWelcomeAddress, {
          error: localization.invalidEnum,
        }),
        ...formEstablishmentCommonShape,
      }),
      z.object({
        contactMode: z.enum(contactModesWithWelcomeAddress, {
          error: localization.invalidEnum,
        }),
        potentialBeneficiaryWelcomeAddress: addressAndPositionSchema,
        ...formEstablishmentCommonShape,
      }),
    ])
    .and(withAcquisitionSchema)
    .refine(
      (formEstablishment) =>
        formEstablishment.contactMode === "PHONE"
          ? formEstablishment.userRights
              .map((right) => right.isMainContactByPhone)
              .filter((isMainContactByPhone) => isMainContactByPhone === true)
              .length === 1
          : true,
      {
        message:
          "En cas de mode de contact par téléphone, vous devez renseigner un contact principal par téléphone.",
        path: ["userRights"],
      },
    )
    .refine(
      (formEstablishment) =>
        formEstablishment.contactMode === "IN_PERSON"
          ? formEstablishment.userRights
              .map((right) => right.isMainContactInPerson)
              .filter((isMainContactInPerson) => isMainContactInPerson === true)
              .length === 1
          : true,
      {
        message:
          "En cas de mode de contact en personne, vous devez renseigner un contact principal.",
        path: ["userRights"],
      },
    )
    .and(withBannedEstablishmentInformationSchema);

export const withFormEstablishmentSchema: ZodSchemaWithInputMatchingOutput<WithFormEstablishmentDto> =
  z.object({
    formEstablishment: formEstablishmentSchema,
  });

export const formEstablishmentBatchSchema: ZodSchemaWithInputMatchingOutput<FormEstablishmentBatchDto> =
  z.object({
    groupName: zStringMinLength1Max1024,
    title: zStringMinLength1Max1024,
    description: zStringMinLength1Max1024,
    formEstablishments: z.array(formEstablishmentSchema),
  });

const siretAdditionFailure: ZodSchemaWithInputMatchingOutput<SiretAdditionFailure> =
  z.object({
    siret: siretSchema,
    errorMessage: z.string(),
  });
export const establishmentBatchReportSchema: ZodSchemaWithInputMatchingOutput<EstablishmentBatchReport> =
  z.object({
    numberOfEstablishmentsProcessed: z.number(),
    numberOfSuccess: z.number(),
    failures: z.array(siretAdditionFailure),
  });

const csvBooleanSchema: ZodSchemaWithInputMatchingOutput<CSVBoolean> = z.enum(
  ["1", "0", ""],
  {
    error: localization.invalidEnum,
  },
);

export const establishmentCSVRowSchema: ZodSchemaWithInputMatchingOutput<EstablishmentCSVRow> =
  z.object({
    siret: siretSchema,
    businessNameCustomized: zStringCanBeEmpty,
    businessName: zStringMinLength1Max1024,
    businessAddress: addressWithPostalCodeSchema,
    naf_code: zStringMinLength1Max1024,
    offers_appellation_code: zStringMinLength1Max1024,
    isEngagedEnterprise: csvBooleanSchema,
    contactMode: contactModeSchema,
    maxContactPerMonth: zStringMinLength1Max8.optional(),
    website: zStringCanBeEmpty,
    additionalInformation: zStringCanBeEmptyMax9200,
    fitForDisabledWorkers: csvBooleanSchema,
    searchableByJobSeekers: csvBooleanSchema,
    searchableByStudents: csvBooleanSchema,
    right1_email: emailSchema,
    right1_phone: phoneNumberSchema,
    right1_job: zStringMinLength1Max1024,
    right2_role: establishmentRoleSchema.optional(),
    right2_email: emailSchema.optional(),
    right2_phone: phoneNumberSchema.optional(),
    right2_job: zStringMinLength1Max1024.optional(),
    right3_role: establishmentRoleSchema.optional(),
    right3_email: emailSchema.optional(),
    right3_phone: phoneNumberSchema.optional(),
    right3_job: zStringMinLength1Max1024.optional(),
    right4_role: establishmentRoleSchema.optional(),
    right4_email: emailSchema.optional(),
    right4_phone: phoneNumberSchema.optional(),
    right4_job: zStringMinLength1Max1024.optional(),
    right5_role: establishmentRoleSchema.optional(),
    right5_email: emailSchema.optional(),
    right5_phone: phoneNumberSchema.optional(),
    right5_job: zStringMinLength1Max1024.optional(),
    right6_role: establishmentRoleSchema.optional(),
    right6_email: emailSchema.optional(),
    right6_phone: phoneNumberSchema.optional(),
    right6_job: zStringMinLength1Max1024.optional(),
    right7_role: establishmentRoleSchema.optional(),
    right7_email: emailSchema.optional(),
    right7_phone: phoneNumberSchema.optional(),
    right7_job: zStringMinLength1Max1024.optional(),
    right8_role: establishmentRoleSchema.optional(),
    right8_email: emailSchema.optional(),
    right8_phone: phoneNumberSchema.optional(),
    right8_job: zStringMinLength1Max1024.optional(),
    right9_role: establishmentRoleSchema.optional(),
    right9_email: emailSchema.optional(),
    right9_phone: phoneNumberSchema.optional(),
    right9_job: zStringMinLength1Max1024.optional(),
    right10_role: establishmentRoleSchema.optional(),
    right10_email: emailSchema.optional(),
    right10_phone: phoneNumberSchema.optional(),
    right10_job: zStringMinLength1Max1024.optional(),
  });

export const establishmentCSVRowsSchema: ZodSchemaWithInputMatchingOutput<
  EstablishmentCSVRow[]
> = z.array(establishmentCSVRowSchema);
