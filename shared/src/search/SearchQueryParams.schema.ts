import { type ZodType, z } from "zod";
import { withAcquisitionSchema } from "../acquisition.dto";
import { addressDepartmentCodeSchema } from "../address/address.schema";
import { fitForDisabledWorkersSchema } from "../formEstablishment/FormEstablishment.schema";
import { groupSlugSchema } from "../group/group.schema";
import { nafCodeSchema, withNafCodesSchema } from "../naf/naf.schema";
import type { SortDirection } from "../pagination/pagination.dto";
import {
  paginationQueryParamsSchema,
  sortDirectionSchema,
} from "../pagination/pagination.schema";
import { withOptionalRemoteWorkModesSchema } from "../remoteWorkMode/remoteWorkMode.schema";
import { romeCodeSchema } from "../rome";
import { appellationCodeSchema } from "../romeAndAppellationDtos/romeAndAppellation.schema";
import { siretSchema } from "../siret/siret.schema";
import { zStringCanBeEmpty } from "../utils/string.schema";
import { zUuidLike } from "../utils/uuid";
import {
  localization,
  type ZodSchemaWithInputMatchingOutput,
  zToBoolean,
  zToNumber,
} from "../zodUtils";
import type {
  GetExternalOffersFlatQueryParams,
  GetOffersFlatQueryParams,
  LegacySearchQueryParamsDto,
} from "./SearchQueryParams.dto";

const placeSchema: ZodSchemaWithInputMatchingOutput<string> = zStringCanBeEmpty;

export const distanceKmSchema = z.coerce
  .number()
  .positive("Cette valeur doit être positive")
  .max(100) as ZodSchemaWithInputMatchingOutput<number>;

const legacyGeoParamsSchema = z.discriminatedUnion("sortedBy", [
  z.object({
    sortedBy: z.enum(["date", "score"], {
      error: localization.invalidEnum,
    }),
    latitude: zToNumber.optional(),
    longitude: zToNumber.optional(),
    distanceKm: distanceKmSchema.optional(),
  }),
  z.object({
    sortedBy: z.literal("distance"),
    latitude: zToNumber,
    longitude: zToNumber,
    distanceKm: distanceKmSchema,
  }),
]);

export const legacySearchParamsSchema: ZodSchemaWithInputMatchingOutput<LegacySearchQueryParamsDto> =
  z
    .object({
      appellationCodes: z.array(appellationCodeSchema).optional(),
      siret: siretSchema.optional(),
      voluntaryToImmersion: z.undefined().or(zToBoolean.optional()),
      place: placeSchema.optional(),
      establishmentSearchableBy: z
        .enum(["students", "jobSeekers"], {
          error: localization.invalidEnum,
        })
        .optional(),
      fitForDisabledWorkers: z.undefined().or(zToBoolean.optional()),
    })
    .and(withNafCodesSchema)
    .and(legacyGeoParamsSchema)
    .and(withAcquisitionSchema)
    .and(
      z.object({
        rome: romeCodeSchema.optional(),
      }),
    );

const latLonDistanceSchema = z.object({
  latitude: zToNumber,
  longitude: zToNumber,
  distanceKm: distanceKmSchema,
});

const geoParamsByDistanceSchema = z.object({
  sortBy: z.literal("distance"),
  sortOrder: sortDirectionSchema.default("asc"),
  latitude: zToNumber,
  longitude: zToNumber,
  distanceKm: distanceKmSchema,
});

const geoParamsByDateOrScoreSchema = z.object({
  sortBy: z.enum(["date", "score"], {
    error: localization.invalidEnum,
  }),
  sortOrder: sortDirectionSchema.default("desc"),
  latitude: zToNumber.optional(),
  longitude: zToNumber.optional(),
  distanceKm: distanceKmSchema.optional(),
});

const geoParamsAndSortSchema = z.discriminatedUnion("sortBy", [
  geoParamsByDateOrScoreSchema,
  geoParamsByDistanceSchema,
]);

const singleOrArray = <T>(
  schema: ZodType<T>,
): ZodType<Array<T> | undefined, Array<T> | undefined> =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value : [value]),
    z.array(schema),
  );

export const getOffersFlatParamsSchema: z.ZodType<
  GetOffersFlatQueryParams,
  Omit<GetOffersFlatQueryParams, "sortOrder"> & {
    sortOrder?: SortDirection | undefined;
  }
> = z
  .object({
    appellationCodes: singleOrArray(appellationCodeSchema).optional(),
    departmentCodes: singleOrArray(addressDepartmentCodeSchema).optional(),
    fitForDisabledWorkers: singleOrArray(
      fitForDisabledWorkersSchema,
    ).optional(),
    locationIds: singleOrArray(zUuidLike).optional(),
    nafCodes: singleOrArray(nafCodeSchema).optional(),
    sirets: singleOrArray(siretSchema).optional(),
    searchableBy: z
      .enum(["students", "jobSeekers"], {
        error: localization.invalidEnum,
      })
      .optional(),
    place: placeSchema.optional(),
    showOnlyAvailableOffers: zToBoolean.optional(),
    group: groupSlugSchema.optional(),
  })
  .and(paginationQueryParamsSchema)
  .and(geoParamsAndSortSchema)
  .and(withAcquisitionSchema)
  .and(withOptionalRemoteWorkModesSchema);

export const getExternalOffersFlatParamsSchema: z.ZodType<
  GetExternalOffersFlatQueryParams,
  Omit<GetExternalOffersFlatQueryParams, "sortOrder"> & {
    sortOrder?: SortDirection;
  }
> = z
  .object({
    appellationCode: appellationCodeSchema,
    nafCodes: singleOrArray(nafCodeSchema).optional(),
  })
  .and(paginationQueryParamsSchema)
  .and(latLonDistanceSchema)
  .and(withAcquisitionSchema);
