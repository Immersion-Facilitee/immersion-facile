import { isEmpty, uniqBy } from "ramda";
import {
  type AppellationAndRomeDto,
  type AppellationCode,
  conflictErrorSiret,
  type DataWithPagination,
  errors,
  type GeoPositionDto,
  type InternalOfferDto,
  type LocationId,
  path,
  pathEq,
  type RemoteWorkMode,
  type RomeCode,
  replaceArrayElement,
  type SiretDto,
} from "shared";
import { distanceBetweenCoordinatesInMeters } from "../../../utils/distanceBetweenCoordinatesInMeters";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import { hasSearchMadeGeoParams } from "../entities/SearchMadeEntity";
import type {
  EstablishmentAggregateFilters,
  EstablishmentAggregateRepository,
  GetOffersParams,
  LegacySearchImmersionParams,
  SearchImmersionResult,
  UpdateEstablishmentsWithInseeDataParams,
} from "../ports/EstablishmentAggregateRepository";

export const TEST_ROME_LABEL = "test_rome_label";

export class InMemoryEstablishmentAggregateRepository
  implements EstablishmentAggregateRepository
{
  #establishmentAggregates: EstablishmentAggregate[] = [];

  public async delete(siret: SiretDto): Promise<void> {
    const formEstablishmentIndex = this.#establishmentAggregates.findIndex(
      (formEstablishment) => formEstablishment.establishment.siret === siret,
    );
    if (formEstablishmentIndex === -1)
      throw errors.establishment.notFound({ siret });
    this.#establishmentAggregates.splice(formEstablishmentIndex, 1);
  }

  // for test purposes only :
  public get establishmentAggregates() {
    return this.#establishmentAggregates;
  }

  public set establishmentAggregates(establishmentAggregates: EstablishmentAggregate[]) {
    this.#establishmentAggregates = establishmentAggregates;
  }

  public async getEstablishmentAggregateBySiret(
    siret: SiretDto,
  ): Promise<EstablishmentAggregate | undefined> {
    return this.#establishmentAggregates.find(
      pathEq("establishment.siret", siret),
    );
  }

  public async getEstablishmentAggregatesByFilters(
    filters: EstablishmentAggregateFilters,
  ): Promise<EstablishmentAggregate[]> {
    if (isEmpty(filters)) return [];
    const { userId, nameIncludes, sirets, ...rest } = filters;
    rest satisfies Record<string, never>;
    return this.#establishmentAggregates.filter((establishmentAggregate) => {
      const matchesUserId = userId
        ? establishmentAggregate.userRights.some(
            (userRight) => userRight.userId === userId,
          )
        : true;

      const matchesName = nameIncludes
        ? establishmentAggregate.establishment.name.includes(nameIncludes)
        : true;

      const matchesSiret = sirets
        ? sirets.includes(establishmentAggregate.establishment.siret)
        : true;

      return matchesUserId && matchesName && matchesSiret;
    });
  }

  public async getOffersAsAppellationAndRomeDtosBySiret(
    siret: string,
  ): Promise<AppellationAndRomeDto[]> {
    return (
      this.establishmentAggregates
        .find(pathEq("establishment.siret", siret))
        ?.offers.map((offer) => ({
          romeCode: offer.romeCode,
          appellationCode: offer.appellationCode?.toString() ?? "", // Should not be undefined though
          romeLabel: offer.romeLabel,
          appellationLabel: offer.appellationLabel,
        })) ?? []
    );
  }

  public async getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId: LocationId,
  ): Promise<InternalOfferDto | undefined> {
    const aggregate = this.establishmentAggregates.find(
      (aggregate) => aggregate.establishment.siret === siret,
    );
    if (!aggregate) return;

    const offer = aggregate.offers.find(
      (offer) => offer.appellationCode === appellationCode,
    );
    if (!offer) return;

    return buildSearchImmersionResultDtoForSiretRomeAndLocation({
      establishmentAgg: aggregate,
      searchedAppellationCode: offer.appellationCode,
      locationId,
      remoteWorkMode: offer.remoteWorkMode,
    });
  }

  public async getSiretsOfEstablishmentsNotUpdatedSince({
    updatedBefore,
    limit,
    offset = 0,
  }: {
    updatedBefore: Date;
    limit: number;
    offset?: number;
  }): Promise<SiretDto[]> {
    return this.#establishmentAggregates
      .filter(({ establishment }) => establishment.updatedAt < updatedBefore)
      .sort(
        (a, b) =>
          a.establishment.updatedAt.getTime() -
          b.establishment.updatedAt.getTime(),
      )
      .map(({ establishment }) => establishment.siret)
      .slice(offset, offset + limit);
  }

  public async getSiretsOfEstablishmentsNotCheckedAtInseeSince(
    checkDate: Date,
    maxResults: number,
  ): Promise<SiretDto[]> {
    return this.#establishmentAggregates
      .filter(
        (establishmentAggregate) =>
          !establishmentAggregate.establishment.lastInseeCheckDate ||
          establishmentAggregate.establishment.lastInseeCheckDate < checkDate,
      )
      .map(({ establishment }) => establishment.siret)
      .slice(0, maxResults);
  }

  public async getSiretsOfEstablishmentsWithRomeCode(
    rome: string,
  ): Promise<SiretDto[]> {
    return this.#establishmentAggregates
      .filter(
        (aggregate) =>
          !!aggregate.offers.find((offer) => offer.romeCode === rome),
      )
      .map(path("establishment.siret"));
  }

  public async hasEstablishmentAggregateWithSiret(
    siret: string,
  ): Promise<boolean> {
    if (siret === conflictErrorSiret)
      throw errors.establishment.conflictError({ siret });
    return !!this.#establishmentAggregates.find(
      (aggregate) => aggregate.establishment.siret === siret,
    );
  }

  public async insertEstablishmentAggregate(aggregate: EstablishmentAggregate) {
    this.#establishmentAggregates = [
      ...this.#establishmentAggregates,
      ...[aggregate],
    ];
  }

  public async markEstablishmentAsSearchableWhenRecentDiscussionAreUnderMaxContactPerMonth(): Promise<number> {
    // not implemented because this method is used only in a script,
    // and the use case consists only in a PG query
    throw new Error("NOT implemented");
  }

  public async getOffers(
    params: GetOffersParams,
  ): Promise<DataWithPagination<InternalOfferDto>> {
    const { filters, pagination } = params;

    const allOffers = this.establishmentAggregates
      .filter((aggregate) => aggregate.establishment.isOpen)
      .filter((aggregate) =>
        filters.showOnlyAvailableOffers
          ? aggregate.establishment.isMaxDiscussionsForPeriodReached === false
          : true,
      )
      .filter((aggregate) =>
        filters.sirets?.length
          ? filters.sirets.includes(aggregate.establishment.siret)
          : true,
      )
      .filter((aggregate) =>
        filters.excludedSirets?.length
          ? !filters.excludedSirets.includes(aggregate.establishment.siret)
          : true,
      )
      .filter((aggregate) => {
        if (filters.fitForDisabledWorkers === undefined) return true;
        return filters.fitForDisabledWorkers.includes(
          aggregate.establishment.fitForDisabledWorkers,
        );
      })
      .filter((aggregate) =>
        filters.nafCodes?.length
          ? filters.nafCodes.includes(aggregate.establishment.nafDto.code)
          : true,
      )
      .filter((aggregate) =>
        filters.searchableBy
          ? aggregate.establishment.searchableBy[filters.searchableBy]
          : true,
      )
      .filter((aggregate) =>
        filters.locationIds?.length
          ? aggregate.establishment.locations.some((loc) =>
              filters.locationIds?.includes(loc.id),
            )
          : true,
      )
      .filter((aggregate) =>
        filters.departmentCodes?.length
          ? aggregate.establishment.locations.some((loc) =>
              filters.departmentCodes?.includes(loc.address.departmentCode),
            )
          : true,
      )
      .flatMap((aggregate) =>
        aggregate.offers
          .filter((offer) =>
            filters.appellationCodes?.length
              ? filters.appellationCodes.includes(offer.appellationCode)
              : true,
          )
          .filter((offer) =>
            filters.remoteWorkModes?.length
              ? filters.remoteWorkModes.includes(offer.remoteWorkMode)
              : true,
          )
          .map((offer) =>
            establishmentAggregateToSearchResultByRomeForFirstLocation({
              establishmentAggregate: aggregate,
              romeCode: offer.romeCode,
              distance_m: filters.geoParams
                ? distanceBetweenCoordinatesInMeters(
                    aggregate.establishment.locations[0].position,
                    {
                      lat: filters.geoParams.lat,
                      lon: filters.geoParams.lon,
                    },
                  )
                : undefined,
              customScore: undefined,
              remoteWorkMode: offer.remoteWorkMode,
            }),
          ),
      );

    // Apply pagination
    const startIndex = (pagination.page - 1) * pagination.perPage;
    const paginatedOffers = allOffers.slice(
      startIndex,
      startIndex + pagination.perPage,
    );

    return {
      data: paginatedOffers,
      pagination: {
        currentPage: pagination.page,
        numberPerPage: pagination.perPage,
        totalPages: Math.max(
          1,
          Math.ceil(allOffers.length / pagination.perPage),
        ),
        totalRecords: allOffers.length,
      },
    };
  }

  public async legacySearchImmersionResults({
    searchMade,
    fitForDisabledWorkers,
    maxResults,
  }: LegacySearchImmersionParams): Promise<SearchImmersionResult[]> {
    return this.#establishmentAggregates
      .filter((aggregate) => aggregate.establishment.isOpen)
      .filter((aggregate) =>
        searchMade.searchableBy
          ? aggregate.establishment.searchableBy[searchMade.searchableBy]
          : true,
      )
      .filter((agg) => {
        if (fitForDisabledWorkers === undefined) return true;
        if (fitForDisabledWorkers === true) {
          return ["yes-declared-only", "yes-ft-certified"].includes(
            agg.establishment.fitForDisabledWorkers,
          );
        }

        if (fitForDisabledWorkers === false) {
          return ["no"].includes(agg.establishment.fitForDisabledWorkers);
        }

        fitForDisabledWorkers satisfies never;
        return false;
      })
      .filter((aggregate) =>
        searchMade.nafCodes?.length
          ? searchMade.nafCodes.includes(aggregate.establishment.nafDto.code)
          : true,
      )
      .flatMap((aggregate) =>
        uniqBy((offer) => offer.romeCode, aggregate.offers)
          .filter(
            (offer) =>
              !searchMade.appellationCodes ||
              searchMade.appellationCodes.includes(offer.appellationCode),
          )
          .map((offer) =>
            buildSearchImmersionResultDtoForSiretRomeAndLocation({
              establishmentAgg: aggregate,
              searchedAppellationCode: offer.appellationCode,
              ...(hasSearchMadeGeoParams(searchMade)
                ? {
                    position: {
                      lat: searchMade.lat,
                      lon: searchMade.lon,
                    },
                  }
                : {}),
              locationId: aggregate.establishment.locations[0].id,
              remoteWorkMode: offer.remoteWorkMode,
            }),
          ),
      )
      .slice(0, maxResults);
  }

  public async updateEstablishmentAggregate(
    aggregate: EstablishmentAggregate,
    updatedAt: Date,
  ) {
    const aggregateIndex = this.#establishmentAggregates.findIndex(
      pathEq("establishment.siret", aggregate.establishment.siret),
    );
    if (aggregateIndex === -1)
      throw errors.establishment.notFound({
        siret: aggregate.establishment.siret,
      });
    this.#establishmentAggregates = replaceArrayElement(
      this.#establishmentAggregates,
      aggregateIndex,
      {
        ...aggregate,
        establishment: { ...aggregate.establishment, updatedAt },
      },
    );
  }

  public async updateEstablishmentsWithInseeData(
    inseeCheckDate: Date,
    params: UpdateEstablishmentsWithInseeDataParams,
  ): Promise<void> {
    this.#establishmentAggregates = this.#establishmentAggregates.map(
      (aggregate) => {
        const newValues = params[aggregate.establishment.siret];
        return newValues
          ? {
              ...aggregate,
              establishment: {
                ...aggregate.establishment,
                ...newValues,
                lastInseeCheckDate: inseeCheckDate,
              },
            }
          : aggregate;
      },
    );
  }

  public async getSiretsInRepoFromSiretList(
    sirets: SiretDto[],
  ): Promise<SiretDto[]> {
    return this.#establishmentAggregates
      .filter((aggregate) => sirets.includes(aggregate.establishment.siret))
      .map(({ establishment }) => establishment.siret);
  }
}

const buildSearchImmersionResultDtoForSiretRomeAndLocation = ({
  establishmentAgg,
  searchedAppellationCode,
  locationId,
  position,
  remoteWorkMode,
}: {
  establishmentAgg: EstablishmentAggregate;
  searchedAppellationCode: AppellationCode;
  locationId: LocationId;
  position?: GeoPositionDto;
  remoteWorkMode: RemoteWorkMode;
}): SearchImmersionResult => {
  const romeCode =
    establishmentAgg.offers.find(
      (offer) => offer.appellationCode === searchedAppellationCode,
    )?.romeCode ?? "no-offer-matched";

  const location = locationId
    ? establishmentAgg.establishment.locations.find(
        (loc) => loc.id === locationId,
      )
    : establishmentAgg.establishment.locations[0];

  if (!location) {
    throw new Error(
      `NO LOCATION MATCHING PROVIDED ID: ${locationId} OR FIRST LOCATION`,
    );
  }

  return {
    address: location.address,
    naf: establishmentAgg.establishment.nafDto.code,
    nafLabel: "FAKE", // en PG on s'appuie sur la base NAF, l'inMemory n'est pas équipé de ce mapping
    name: establishmentAgg.establishment.name,
    customizedName: establishmentAgg.establishment.customizedName,
    rome: romeCode,
    romeLabel: TEST_ROME_LABEL,
    establishmentScore: establishmentAgg.establishment.score,
    appellations: establishmentAgg.offers
      .filter((immersionOffer) => immersionOffer.romeCode === romeCode)
      .map((immersionOffer) => ({
        appellationLabel: immersionOffer.appellationLabel,
        appellationCode: immersionOffer.appellationCode,
      })),
    siret: establishmentAgg.establishment.siret,
    voluntaryToImmersion: establishmentAgg.establishment.voluntaryToImmersion,
    contactMode: establishmentAgg.establishment.contactMode,
    numberOfEmployeeRange: establishmentAgg.establishment.numberEmployeesRange,
    website: establishmentAgg.establishment?.website,
    additionalInformation:
      establishmentAgg.establishment?.additionalInformation,
    distance_m: position
      ? distanceBetweenCoordinatesInMeters(location.position, position)
      : undefined,
    position: location.position,
    nextAvailabilityDate: establishmentAgg.establishment.nextAvailabilityDate,
    locationId: location.id,
    updatedAt: establishmentAgg.establishment.updatedAt?.toISOString(),
    createdAt: establishmentAgg.establishment.createdAt.toISOString(),
    fitForDisabledWorkers: "no",
    remoteWorkMode: remoteWorkMode,
    isAvailable:
      !establishmentAgg.establishment.isMaxDiscussionsForPeriodReached,
  };
};

export const establishmentAggregateToSearchResultByRomeForFirstLocation = ({
  establishmentAggregate,
  romeCode,
  distance_m,
  customScore,
  remoteWorkMode,
}: {
  establishmentAggregate: EstablishmentAggregate;
  romeCode: RomeCode;
  distance_m?: number;
  customScore?: number;
  remoteWorkMode: RemoteWorkMode;
}): InternalOfferDto => ({
  rome: romeCode,
  establishmentScore: customScore ?? establishmentAggregate.establishment.score,
  naf: establishmentAggregate.establishment.nafDto.code,
  nafLabel: "FAKE", // en PG on s'appuie sur la base NAF, l'inMemory n'est pas équipé de ce mapping
  siret: establishmentAggregate.establishment.siret,
  name: establishmentAggregate.establishment.name,
  customizedName: establishmentAggregate.establishment.customizedName,
  numberOfEmployeeRange:
    establishmentAggregate.establishment.numberEmployeesRange,
  voluntaryToImmersion:
    establishmentAggregate.establishment.voluntaryToImmersion,
  additionalInformation:
    establishmentAggregate.establishment.additionalInformation,
  position: establishmentAggregate.establishment.locations[0].position,
  address: establishmentAggregate.establishment.locations[0].address,
  locationId: establishmentAggregate.establishment.locations[0].id,
  contactMode: establishmentAggregate.establishment.contactMode,
  distance_m,
  romeLabel: TEST_ROME_LABEL,
  website: establishmentAggregate.establishment.website,
  appellations: establishmentAggregate.offers
    .filter(
      (offer) =>
        offer.romeCode === romeCode && offer.remoteWorkMode === remoteWorkMode,
    )
    .map((offer) => ({
      appellationCode: offer.appellationCode,
      appellationLabel: offer.appellationLabel,
    })),
  updatedAt: establishmentAggregate.establishment.updatedAt?.toISOString(),
  createdAt: establishmentAggregate.establishment.createdAt.toISOString(),
  fitForDisabledWorkers: "no",
  remoteWorkMode: remoteWorkMode,
  isAvailable:
    !establishmentAggregate.establishment.isMaxDiscussionsForPeriodReached,
});
