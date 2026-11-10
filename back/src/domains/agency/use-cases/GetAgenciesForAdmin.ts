import {
  type AdminAgencyListItemDto,
  type AgencyWithUsersRights,
  type ConnectedUser,
  type DataWithPagination,
  type GetAgenciesForAdminParams,
  getAgenciesForAdminParamsSchema,
  getPaginationParamsForWeb,
  removeSpaces,
  siretRegex,
} from "shared";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { GetAgenciesFilters } from "../ports/AgencyRepository";

export type GetAgenciesForAdmin = ReturnType<typeof makeGetAgenciesForAdmin>;

export const makeGetAgenciesForAdmin = useCaseBuilder("GetAgenciesForAdmin")
  .withInput<GetAgenciesForAdminParams>(getAgenciesForAdminParamsSchema)
  .withOutput<DataWithPagination<AdminAgencyListItemDto>>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ inputParams, uow, currentUser }) => {
    throwIfNotAdmin(currentUser);

    const { page, perPage, search, kinds, statuses } = inputParams;

    const { data, pagination } = await uow.agencyRepository.getAgencies({
      filters: {
        ...toSearchFilters(search),
        kinds,
        status: statuses,
      },
      sort: { by: "createdAt", direction: "desc" },
      pagination: getPaginationParamsForWeb({ page, perPage }),
    });

    return {
      data: data.map(toAdminAgencyListItemDto),
      pagination,
    };
  });

const toSearchFilters = (
  search: string | undefined,
): Pick<GetAgenciesFilters, "nameIncludes" | "sirets"> => {
  if (!search) return {};
  if (siretRegex.test(search)) return { sirets: [removeSpaces(search)] };
  return { nameIncludes: search };
};

const toAdminAgencyListItemDto = (
  agency: AgencyWithUsersRights,
): AdminAgencyListItemDto => ({
  id: agency.id,
  name: agency.name,
  kind: agency.kind,
  status: agency.status,
  siret: agency.agencySiret,
  refersToAgencyName: agency.refersToAgencyName,
});
