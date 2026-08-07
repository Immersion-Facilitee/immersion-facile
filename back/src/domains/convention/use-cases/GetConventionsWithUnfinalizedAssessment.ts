import {
  type AgencyRole,
  type ConnectedUser,
  type ConventionWithUnfinalizedAssessment,
  type DataWithPagination,
  errors,
  type GetConventionsWithUnfinalizedAssessmentParams,
  getConventionsWithUnfinalizedAssessmentParamsSchema,
  getPaginationParamsForWeb,
} from "shared";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type GetConventionsWithUnfinalizedAssessment = ReturnType<
  typeof makeGetConventionsWithUnfinalizedAssessment
>;

export const makeGetConventionsWithUnfinalizedAssessment = useCaseBuilder(
  "GetConventionsWithUnfinalizedAssessment",
)
  .withInput<GetConventionsWithUnfinalizedAssessmentParams>(
    getConventionsWithUnfinalizedAssessmentParamsSchema,
  )
  .withOutput<DataWithPagination<ConventionWithUnfinalizedAssessment>>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ inputParams, uow, currentUser, deps }) => {
    const allowedAgencyRoles: AgencyRole[] = [
      "agency-admin",
      "agency-viewer",
      "counsellor",
      "validator",
    ];

    const allowedAgencyRights = currentUser.agencyRights.filter((agencyRight) =>
      agencyRight.roles.some((role) => allowedAgencyRoles.includes(role)),
    );

    if (!allowedAgencyRights.length)
      throw errors.agencies.noAgencyRights(currentUser.id);

    const userAgencyIds = allowedAgencyRights.map(
      (agencyRight) => agencyRight.agency.id,
    );

    return uow.conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
      {
        userAgencyIds,
        pagination: getPaginationParamsForWeb(inputParams.pagination),
        now: deps.timeGateway.now(),
        filters: inputParams.filters,
      },
    );
  });
