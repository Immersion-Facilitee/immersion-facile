import {
  type AgencyKind,
  type AgencyKindFilter,
  type AgencyOption,
  type AgencyWithUsersRights,
  activeAgencyStatuses,
  listAgencyOptionsRequestSchema,
  miniStageAgencyKinds,
  orderedAgencyKindList,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { GetAgenciesFilters } from "../ports/AgencyRepository";

export type ListAgencyOptionsByFilter = ReturnType<
  typeof makeListAgencyOptionsByFilter
>;
export const makeListAgencyOptionsByFilter = useCaseBuilder(
  "ListAgencyOptionsByFilter",
)
  .withInput(listAgencyOptionsRequestSchema)
  .build(async ({ uow, inputParams }) => {
    const { departmentCode, nameIncludes, filterKind, siret, status, limit } =
      inputParams;

    const extraFilters = getFiltersFromFilterKind(filterKind);
    const { data: agencies } = await uow.agencyRepository.getAgencies({
      filters: {
        nameIncludes,
        departmentCode,
        status: status ? status : activeAgencyStatuses,
        sirets: siret ? [siret] : undefined,
        ...extraFilters,
      },
      ...(limit
        ? {
            pagination: {
              page: 1,
              perPage: limit,
            },
          }
        : {}),
    });

    return agencies.map(toAgencyOption);
  });

const getFiltersFromFilterKind = (
  filterKind?: AgencyKindFilter,
): GetAgenciesFilters => {
  if (!filterKind) return {};

  const doesNotReferToOtherAgency =
    filterKind === "withoutRefersToAgency" ? true : undefined;

  return {
    kinds: getAgencyKindsFromFilterKind(filterKind),
    doesNotReferToOtherAgency,
  };
};

const getAgencyKindsFromFilterKind = (
  filterKind: AgencyKindFilter,
): AgencyKind[] | undefined => {
  if (filterKind === "withoutRefersToAgency") return undefined;
  if (filterKind === "immersionFtOnly") return ["france-travail"];
  if (filterKind === "miniStageOnly") return miniStageAgencyKinds;
  if (filterKind === "miniStageExcluded")
    return orderedAgencyKindList.filter(
      (agencyKind) => !miniStageAgencyKinds.includes(agencyKind),
    );
  filterKind satisfies never;
};

export const toAgencyOption = (
  agency: AgencyWithUsersRights,
): AgencyOption => ({
  id: agency.id,
  name: agency.name,
  kind: agency.kind,
  status: agency.status,
  address: agency.address,
  refersToAgencyName: agency.refersToAgencyName,
});
