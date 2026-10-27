import { keys, uniq } from "ramda";
import {
  type AdminConventionListDto,
  type AgencyWithUsersRights,
  adminConventionListMaxResults,
  type ConnectedUser,
  type ConventionDto,
  type DataWithPagination,
  type DateFilter,
  type DateString,
  type DepartmentCode,
  departmentNameToDepartmentCode,
  errors,
  type FlatGetConventionsForAdminParams,
  flatGetConventionsForAdminParamsSchema,
  getPaginationParamsForWeb,
} from "shared";
import { toFederatedIdentityWithoutToken } from "../../../utils/convention";
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
          dateStart: toDateFilter(dateStartFrom, dateStartTo),
          dateValidation: toDateFilter(dateValidationFrom, dateValidationTo),
        },
        sort: { by: "dateSubmission", direction: "desc" },
        pagination: getPaginationParamsForWeb({ page, perPage }),
        maxTotalRecords: adminConventionListMaxResults,
      });

    const agencies = await uow.agencyRepository.getByIds(
      uniq(paginatedConventions.data.map(({ agencyId }) => agencyId)),
    );

    return {
      data: paginatedConventions.data.map((convention) =>
        toAdminConventionListDto(convention, agencies),
      ),
      pagination: paginatedConventions.pagination,
    };
  });

const toDateFilter = (
  from: DateString | undefined,
  to: DateString | undefined,
): DateFilter | undefined => (from || to ? { from, to } : undefined);

const toDepartmentName = (departmentCode: DepartmentCode): string | null =>
  keys(departmentNameToDepartmentCode).find(
    (departmentName) =>
      departmentNameToDepartmentCode[departmentName] === departmentCode,
  ) ?? null;

const toAdminConventionListDto = (
  convention: ConventionDto,
  agencies: AgencyWithUsersRights[],
): AdminConventionListDto => {
  const agency = agencies.find(({ id }) => id === convention.agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId: convention.agencyId });

  const { beneficiary } = convention.signatories;

  return {
    id: convention.id,
    ...(convention.sourceConventionDraftId
      ? { sourceConventionDraftId: convention.sourceConventionDraftId }
      : {}),
    status: convention.status,
    dateSubmission: convention.dateSubmission,
    agency: {
      name: agency.name,
      kind: agency.kind,
      refersToAgencyName: agency.refersToAgencyName,
      departmentName: toDepartmentName(agency.address.departmentCode),
    },
    businessName: convention.businessName,
    siret: convention.siret,
    immersionAppellation: convention.immersionAppellation,
    dateStart: convention.dateStart,
    dateEnd: convention.dateEnd,
    beneficiary: {
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
      federatedIdentity: toFederatedIdentityWithoutToken(
        beneficiary.federatedIdentity,
      ),
    },
  };
};
