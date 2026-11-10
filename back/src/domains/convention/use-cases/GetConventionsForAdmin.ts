import { keys } from "ramda";
import {
  type AdminConventionListDto,
  adminConventionListMaxResults,
  type ConnectedUser,
  type DataWithPagination,
  type DateFilter,
  type DateString,
  type DepartmentCode,
  departmentNameToDepartmentCode,
  type FlatGetConventionsForAdminParams,
  flatGetConventionsForAdminParamsSchema,
  getPaginationParamsForWeb,
} from "shared";
import {
  type ConventionWithAgencyAndAssessment,
  mapConventionsWithAgencyAndAssessment,
  toAgencyUserConventionListDto,
} from "../../../utils/convention";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetConventionsForAdmin = ReturnType<
  typeof makeGetConventionsForAdmin
>;

export const makeGetConventionsForAdmin = useCaseBuilder(
  "GetConventionsForAdmin",
)
  .withInput<FlatGetConventionsForAdminParams>(
    flatGetConventionsForAdminParamsSchema,
  )
  .withOutput<DataWithPagination<AdminConventionListDto>>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ inputParams, uow, currentUser }) => {
    throwIfNotAdmin(currentUser);

    const {
      page,
      perPage,
      sortBy,
      search,
      dateStartFrom,
      dateStartTo,
      dateValidationFrom,
      dateValidationTo,
      ...filters
    } = inputParams;

    const paginatedConventions =
      await uow.conventionQueries.getPaginatedConventions({
        filters: {
          ...filters,
          identifierOrNameSearch: search,
          dateStart: toDateFilter(dateStartFrom, dateStartTo),
          dateValidation: toDateFilter(dateValidationFrom, dateValidationTo),
        },
        sort: { by: sortBy ?? "dateSubmission", direction: "desc" },
        pagination: getPaginationParamsForWeb({ page, perPage }),
        maxTotalRecords: adminConventionListMaxResults,
      });

    return {
      data: await mapConventionsWithAgencyAndAssessment(
        paginatedConventions.data,
        uow,
        toAdminConventionListDto,
      ),
      pagination: paginatedConventions.pagination,
    };
  });

const toDateFilter = (
  from: DateString | undefined,
  to: DateString | undefined,
): DateFilter | undefined =>
  from || to ? { from, to: to && toEndOfUtcDay(to) } : undefined;

const toEndOfUtcDay = (date: DateString): DateString => {
  const endOfUtcDay = new Date(date);
  endOfUtcDay.setUTCHours(23, 59, 59, 999);
  return endOfUtcDay.toISOString();
};

const toDepartmentName = (departmentCode: DepartmentCode): string | null =>
  keys(departmentNameToDepartmentCode).find(
    (departmentName) =>
      departmentNameToDepartmentCode[departmentName] === departmentCode,
  ) ?? null;

const toAdminConventionListDto = (
  conventionWithAgencyAndAssessment: ConventionWithAgencyAndAssessment,
): AdminConventionListDto => {
  const { agency } = conventionWithAgencyAndAssessment;
  return {
    ...toAgencyUserConventionListDto(conventionWithAgencyAndAssessment),
    agencyKind: agency.kind,
    agencyDepartmentName: toDepartmentName(agency.address.departmentCode),
    agencyRefersToAgencyName: agency.refersToAgencyName,
  };
};
