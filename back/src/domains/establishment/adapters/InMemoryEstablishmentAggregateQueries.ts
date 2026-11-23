import { sortBy } from "ramda";
import {
  type AdminEstablishmentListItemDto,
  type AppellationCode,
  calculateLimitAndOffsetFromPagination,
  calculatePaginationResult,
  type DataWithPagination,
  type LocationId,
  type SiretDto,
  toLowerCaseWithoutDiacritics,
} from "shared";
import type { InMemoryConventionRepository } from "../../convention/adapters/InMemoryConventionRepository";
import type { InMemoryUserRepository } from "../../core/authentication/connected-user/adapters/InMemoryUserRepository";
import type { EstablishmentAggregate } from "../entities/EstablishmentAggregate";
import type {
  EstablishmentAggregateQueries,
  GetEstablishmentsForAdminQueryParams,
} from "../ports/EstablishmentAggregateQueries";
import type { RepositorySearchResultDto } from "../ports/EstablishmentAggregateRepository";
import type { InMemoryDiscussionRepository } from "./InMemoryDiscussionRepository";
import {
  buildSearchImmersionResultDtoForSiretRomeAndLocation,
  type InMemoryEstablishmentAggregateRepository,
} from "./InMemoryEstablishmentAggregateRepository";

export class InMemoryEstablishmentAggregateQueries
  implements EstablishmentAggregateQueries
{
  constructor(
    private readonly establishmentAggregateRepository: InMemoryEstablishmentAggregateRepository,
    private readonly discussionRepository: InMemoryDiscussionRepository,
    private readonly conventionRepository: InMemoryConventionRepository,
    private readonly userRepository: InMemoryUserRepository,
  ) {}

  public async getSearchResultBySearchQuery(
    siret: SiretDto,
    appellationCode: AppellationCode,
    locationId?: LocationId,
  ): Promise<RepositorySearchResultDto | undefined> {
    const aggregate =
      this.establishmentAggregateRepository.establishmentAggregates.find(
        (aggregate) => aggregate.establishment.siret === siret,
      );
    if (!aggregate) return;

    const offer = aggregate.offers.find(
      (offer) => offer.appellationCode === appellationCode,
    );
    if (!offer) return;

    const { locations } = aggregate.establishment;

    const resolvedLocationId =
      locations.find((location) => location.id === locationId)?.id ??
      locations[locations.length - 1].id;

    const { nextAvailabilityDate: _, ...searchResult } =
      buildSearchImmersionResultDtoForSiretRomeAndLocation({
        establishmentAgg: aggregate,
        searchedAppellationCode: offer.appellationCode,
        locationId: resolvedLocationId,
        remoteWorkMode: offer.remoteWorkMode,
      });

    return searchResult;
  }

  public async getEstablishmentsForAdmin({
    search,
    pagination,
  }: GetEstablishmentsForAdminQueryParams): Promise<
    DataWithPagination<AdminEstablishmentListItemDto>
  > {
    const matchingAggregates =
      this.establishmentAggregateRepository.establishmentAggregates
        .filter((aggregate) =>
          search ? this.#isMatchingSearch(aggregate, search) : true,
        )
        .sort(
          (a, b) =>
            b.establishment.updatedAt.getTime() -
              a.establishment.updatedAt.getTime() ||
            a.establishment.siret.localeCompare(b.establishment.siret),
        );

    const { limit, offset } = calculateLimitAndOffsetFromPagination(pagination);

    return {
      data: matchingAggregates
        .slice(offset, offset + limit)
        .map((aggregate) => this.#toAdminEstablishmentListItem(aggregate)),
      pagination: calculatePaginationResult({
        ...pagination,
        totalRecords: matchingAggregates.length,
      }),
    };
  }

  #isMatchingSearch(
    { establishment, userRights }: EstablishmentAggregate,
    search: string,
  ): boolean {
    const lowerCasedSearch = search.toLowerCase();
    const searchedEmail = toLowerCaseWithoutDiacritics(search);
    const includesSearch = (value: string | undefined): boolean =>
      value?.toLowerCase().includes(lowerCasedSearch) ?? false;

    return (
      establishment.siret === search ||
      includesSearch(establishment.name) ||
      includesSearch(establishment.customizedName) ||
      this.userRepository.users.some(
        (user) =>
          userRights.some((userRight) => userRight.userId === user.id) &&
          (user.email === searchedEmail ||
            includesSearch(
              `${user.firstName} ${user.lastName} ${user.firstName}`,
            )),
      )
    );
  }

  #toAdminEstablishmentListItem({
    establishment,
  }: EstablishmentAggregate): AdminEstablishmentListItemDto {
    const [firstLocation] = sortBy(
      (location) => location.id,
      establishment.locations,
    );

    return {
      siret: establishment.siret,
      name: establishment.name,
      customizedName: establishment.customizedName ?? null,
      city: firstLocation.address.city,
      postcode: firstLocation.address.postcode,
      otherLocationsCount: establishment.locations.length - 1,
      createdAt: establishment.createdAt.toISOString(),
      updatedAt: establishment.updatedAt.toISOString(),
      discussionsCount: this.discussionRepository.discussions.filter(
        (discussion) => discussion.siret === establishment.siret,
      ).length,
      validatedConventionsCount: this.conventionRepository.conventions.filter(
        (convention) =>
          convention.siret === establishment.siret &&
          convention.status === "ACCEPTED_BY_VALIDATOR",
      ).length,
    };
  }
}
