import { subMonths } from "date-fns";
import {
  type AgencyRight,
  type AgencyRole,
  type AgencyUserConventionListDto,
  type ConnectedUser,
  type DataWithPagination,
  type DateFilter,
  type DateString,
  defaultMonthsThresholdForConventionsListing,
  type GetConventionsForAgencyUserParams,
  type GetPaginatedConventionsSortBy,
  getConventionsForAgencyUserParamsSchema,
  getPaginationParamsForWeb,
  type WithSort,
} from "shared";
import { conventionDtosToAgencyUserConventionListDtos } from "../../../utils/convention";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export const makeGetConventionsForAgencyUser = useCaseBuilder(
  "GetConventionsForAgencyUser",
)
  .withInput<GetConventionsForAgencyUserParams>(
    getConventionsForAgencyUserParamsSchema,
  )
  .withOutput<DataWithPagination<AgencyUserConventionListDto>>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ inputParams, uow, currentUser, deps }) => {
    const { filters, sort } = inputParams;
    const {
      agencyDepartmentCodes: departmentCodesFilter,
      agencyIds: agencyIdsFilter,
      ...restFilters
    } = filters ?? {};

    const withSort: WithSort<GetPaginatedConventionsSortBy> | null = sort?.by
      ? {
          sort: {
            by: sort.by,
            direction: sort.direction ?? "desc",
          },
        }
      : null;

    const pagination = getPaginationParamsForWeb(inputParams.pagination);

    const user = await getUserWithRights(uow, currentUser.id);

    const agencyRightsInScope = user.agencyRights
      .filter(({ roles }) =>
        roles.some((role) => agencyRolesWithConventionAccess.includes(role)),
      )
      .filter(
        ({ agency }) =>
          !departmentCodesFilter?.length ||
          departmentCodesFilter.includes(agency.address.departmentCode),
      )
      .filter(
        ({ agency }) =>
          !agencyIdsFilter?.length || agencyIdsFilter.includes(agency.id),
      );

    const agencyIds = agencyRightsInScope.map(({ agency }) => agency.id);
    const agencyIdsWithRefersToUserIsValidatorOn = agencyRightsInScope
      .filter(isValidatorOfAgencyRefersTo)
      .map(({ agency }) => agency.id);

    const featureFlags = await uow.featureFlagQueries.getAll();

    const paginated = await uow.conventionQueries.getPaginatedConventions({
      ...withSort,
      filters: {
        ...restFilters,
        agencyIds,
        ...(agencyIdsWithRefersToUserIsValidatorOn.length > 0
          ? {
              omitStatusesForAgencies: {
                agencyIds: agencyIdsWithRefersToUserIsValidatorOn,
                statuses: ["READY_TO_SIGN", "PARTIALLY_SIGNED", "IN_REVIEW"],
              },
            }
          : {}),
        ...(featureFlags.enableRequestArchivedConvention.isActive
          ? {}
          : {
              dateEnd: computeDateEnd(
                restFilters.dateEnd,
                deps.timeGateway.now(),
              ),
            }),
      },
      pagination,
    });

    const data = await conventionDtosToAgencyUserConventionListDtos(
      paginated.data,
      uow,
    );

    return { data, pagination: paginated.pagination };
  });

const agencyRolesWithConventionAccess: AgencyRole[] = [
  "counsellor",
  "validator",
  "agency-admin",
  "agency-viewer",
];

const isValidatorOfAgencyRefersTo = ({ agency, roles }: AgencyRight) =>
  !!agency.refersToAgencyId &&
  !roles.includes("counsellor") &&
  !roles.includes("agency-admin") &&
  !roles.includes("agency-viewer");

const computeDateEnd = (
  dateEnd: DateFilter | undefined,
  now: Date,
): DateFilter => ({
  ...dateEnd,
  from: shouldUseDefaultDateEndFrom(dateEnd?.from, now)
    ? subMonths(now, defaultMonthsThresholdForConventionsListing).toISOString()
    : dateEnd?.from,
  to: shouldIgnoreDateEndTo(dateEnd?.to, now) ? undefined : dateEnd?.to,
});

const shouldUseDefaultDateEndFrom = (
  dateEndFrom: DateString | undefined,
  now: Date,
): boolean =>
  dateEndFrom
    ? new Date(dateEndFrom) <=
      subMonths(now, defaultMonthsThresholdForConventionsListing)
    : true;

const shouldIgnoreDateEndTo = (
  dateEndTo: DateString | undefined,
  now: Date,
): boolean =>
  dateEndTo
    ? new Date(dateEndTo) <=
      subMonths(now, defaultMonthsThresholdForConventionsListing)
    : false;
