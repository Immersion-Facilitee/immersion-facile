import {
  type AgencyRole,
  type ConnectedUser,
  type ConventionWithUnfinalizedAssessmentReadDto,
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
  .withOutput<DataWithPagination<ConventionWithUnfinalizedAssessmentReadDto>>()
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

    const result =
      await uow.conventionQueries.getConventionsWithUnfinalizedAssessmentForAgencyUser(
        {
          userAgencyIds,
          pagination: getPaginationParamsForWeb(inputParams.pagination),
          now: deps.timeGateway.now(),
          filters: inputParams.filters,
        },
      );

    return {
      ...result,
      data: result.data.map((conventionWithUnfinalizedAssessment) => {
        const agencyName = currentUser.agencyRights.find(
          (agencyRight) =>
            agencyRight.agency.id ===
            conventionWithUnfinalizedAssessment.agencyId,
        )?.agency.name;
        if (!agencyName)
          throw errors.user.noRightsOnAgency({
            userId: currentUser.id,
            agencyId: conventionWithUnfinalizedAssessment.agencyId,
          });

        return {
          ...conventionWithUnfinalizedAssessment,
          agencyName,
        };
      }),
    };
  });
