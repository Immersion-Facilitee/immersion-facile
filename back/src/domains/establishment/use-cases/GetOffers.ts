import { all, isNil, values } from "ramda";
import {
  type ApiConsumer,
  type DataWithPagination,
  errors,
  type GetOffersPerPageOption,
  getOffersFlatParamsSchema,
  getPaginationParamsForApiConsumer,
  getPaginationParamsForWeb,
  type InternalOfferDto,
  pipeWithValue,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { UuidGenerator } from "../../core/uuid-generator/ports/UuidGenerator";
import {
  type GeoParams,
  hasSearchGeoParams,
  type SearchMade,
  type SearchMadeCommon,
} from "../entities/SearchMadeEntity";

const defaultPerPage: GetOffersPerPageOption = 12;

export const makeGetOffers = useCaseBuilder("GetOffers")
  .withCurrentUser<ApiConsumer | undefined>()
  .withInput(getOffersFlatParamsSchema)
  .withOutput<DataWithPagination<InternalOfferDto>>()
  .withDeps<{
    uuidGenerator: UuidGenerator;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: apiConsumer }) => {
    const {
      page,
      perPage,
      appellationCodes,
      departmentCodes,
      fitForDisabledWorkers,
      locationIds,
      nafCodes,
      remoteWorkModes,
      searchableBy,
      sirets,
      place,
      group,
      showOnlyAvailableOffers,
      ...sortAndPositionParams
    } = inputParams;

    const bannedEstablishments =
      await uow.bannedEstablishmentRepository.getBannedEstablishments();
    const bannedSirets = new Set(bannedEstablishments.map((b) => b.siret));

    const geoParams = getValidatedGeoParams({
      lat: sortAndPositionParams.latitude,
      lon: sortAndPositionParams.longitude,
      distanceKm: sortAndPositionParams.distanceKm,
    });

    const excludedSirets =
      bannedSirets.size > 0 ? Array.from(bannedSirets) : undefined;

    const result = await uow.establishmentAggregateRepository.getOffers({
      pagination: apiConsumer
        ? getPaginationParamsForApiConsumer({
            page,
            perPage,
          })
        : getPaginationParamsForWeb({
            page,
            perPage: perPage ?? defaultPerPage,
          }),
      filters: {
        appellationCodes,
        departmentCodes,
        fitForDisabledWorkers,
        locationIds,
        nafCodes,
        remoteWorkModes,
        searchableBy,
        sirets,
        showOnlyAvailableOffers: showOnlyAvailableOffers ?? true,
        geoParams,
        excludedSirets,
        group,
      },
      sort: { by: inputParams.sortBy, direction: inputParams.sortOrder },
    });

    const searchMadeCommon: SearchMadeCommon = {
      appellationCodes,
      departmentCodes,
      fitForDisabledWorkers,
      locationIds,
      nafCodes,
      remoteWorkModes,
      searchableBy,
      showOnlyAvailableOffers: showOnlyAvailableOffers ?? true,
      sirets: sirets ?? [],
      sortedBy: inputParams.sortBy,
      place,
      group,
    };

    const searchMade: SearchMade = geoParams
      ? { ...searchMadeCommon, ...geoParams }
      : searchMadeCommon;

    await uow.searchMadeRepository.insertSearchMade({
      ...searchMade,
      id: deps.uuidGenerator.new(),
      needsToBeSearched: true, // this is useless (legacy TODO : remove this column)
      numberOfResults: result.data.length,
      apiConsumerName: apiConsumer?.name,
    });

    return result;
  });

const getValidatedGeoParams = (
  geoParams: Partial<GeoParams>,
): GeoParams | undefined => {
  const hasNoGeoParams = pipeWithValue(geoParams, values, all(isNil));

  if (hasNoGeoParams) return undefined;
  if (hasSearchGeoParams(geoParams)) return geoParams;

  throw errors.search.invalidGeoParams();
};
