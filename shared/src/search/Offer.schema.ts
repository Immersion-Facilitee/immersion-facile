import { z } from "zod";
import { absoluteUrlSchema } from "../AbsoluteUrl";
import {
  businessCustomizedNameSchema,
  businessNameSchema,
} from "../establishment/businessComponents.schema";
import {
  fitForDisabledWorkersSchema,
  immersionActivitiesShape,
} from "../formEstablishment/FormEstablishment.schema";
import { geoPositionSchema } from "../geoPosition/geoPosition.schema";
import { nafCodeSchema, nafSousClasseLabelSchema } from "../naf/naf.schema";
import { createPaginatedSchema } from "../pagination/pagination.schema";
import { remoteWorkModeShape } from "../remoteWorkMode/remoteWorkMode.schema";
import { romeCodeSchema } from "../rome";
import {
  appellationCodeSchema,
  appellationLabelSchema,
  romeLabelSchema,
} from "../romeAndAppellationDtos/romeAndAppellation.schema";
import {
  numberOfEmployeesRangeSchema,
  siretSchema,
} from "../siret/siret.schema";
import { dateTimeIsoStringSchema } from "../utils/date";
import {
  zStringCanBeEmpty,
  zStringCanBeEmptyMax9200,
  zStringMinLength1Max1024,
} from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zBoolean,
} from "../zodUtils";
import type { ExternalOfferDto, InternalOfferDto } from "./Offer.dto";

const urlOfPartnerSchema: ZodSchemaWithInputMatchingOutput<string> =
  zStringCanBeEmpty;

const commonOfferSchema = z.object({
  rome: romeCodeSchema,
  romeLabel: romeLabelSchema,
  naf: nafCodeSchema,
  nafLabel: nafSousClasseLabelSchema,
  siret: siretSchema,
  establishmentScore: z.number(),
  name: businessNameSchema,
  customizedName: businessCustomizedNameSchema.optional(),
  voluntaryToImmersion: z.boolean(),
  position: geoPositionSchema,
  address: z.object({
    streetNumberAndAddress: zStringCanBeEmpty,
    postcode: zStringCanBeEmpty,
    departmentCode: zStringMinLength1Max1024,
    city: zStringMinLength1Max1024,
  }),
  contactMode: z
    .enum(["EMAIL", "PHONE", "IN_PERSON"], {
      error: localization.invalidEnum,
    })
    .optional(),
  distance_m: z.number().optional(),
  numberOfEmployeeRange: numberOfEmployeesRangeSchema,
  website: absoluteUrlSchema.or(z.literal("")).optional(),
  additionalInformation: zStringCanBeEmptyMax9200.optional(),
  fitForDisabledWorkers: fitForDisabledWorkersSchema.nullable(),
  urlOfPartner: urlOfPartnerSchema.optional(),
  appellations: z.array(
    z.object({
      appellationLabel: appellationLabelSchema,
      appellationCode: appellationCodeSchema,
      ...immersionActivitiesShape,
    }),
  ),
  updatedAt: dateTimeIsoStringSchema.optional(),
  createdAt: dateTimeIsoStringSchema.optional(),
  locationId: zUuidLike.or(z.null()),
});

export const internalOfferSchema: ZodSchemaWithInputMatchingOutput<InternalOfferDto> =
  commonOfferSchema.extend({
    ...remoteWorkModeShape,
    isAvailable: zBoolean,
  });

export const externalOfferSchema: ZodSchemaWithInputMatchingOutput<ExternalOfferDto> =
  commonOfferSchema;

export const externalSearchResultsSchema = z.array(externalOfferSchema);

export const paginatedSearchResultsSchema =
  createPaginatedSchema(internalOfferSchema);
