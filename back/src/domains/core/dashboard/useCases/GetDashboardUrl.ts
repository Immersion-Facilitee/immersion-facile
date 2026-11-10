import {
  type AbsoluteUrl,
  type ConnectedUser,
  type ConventionDomainJwtPayload,
  type DashboardUrlAndName,
  errors,
  type GetDashboardParams,
  getDashboardParams,
} from "shared";
import { throwIfNotAdmin } from "../../../connected-users/helpers/authorization.helper";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { DashboardGateway } from "../port/DashboardGateway";

export type GetDashboardUrl = ReturnType<typeof makeGetDashboardUrl>;

export const makeGetDashboardUrl = useCaseBuilder("GetDashboardUrl")
  .notTransactional()
  .withInput<GetDashboardParams>(getDashboardParams)
  .withOutput<DashboardUrlAndName>()
  .withCurrentUser<ConnectedUser | ConventionDomainJwtPayload>()
  .withDeps<{ dashboardGateway: DashboardGateway; timeGateway: TimeGateway }>()
  .build(
    async ({
      inputParams,
      deps: { dashboardGateway, timeGateway },
      currentUser,
    }) => {
      if (!currentUser) throw errors.user.unauthorized();

      if ("applicationId" in currentUser) {
        if (inputParams.name !== "conventionStatus")
          throw errors.user.unauthorized();
        if (currentUser.applicationId !== inputParams.conventionId)
          throw errors.user.unauthorized();

        return {
          name: inputParams.name,
          url: dashboardGateway.getConventionStatusUrl(
            inputParams.conventionId,
            timeGateway.now(),
          ),
        };
      }

      throwIfNotAdmin(currentUser);
      return {
        url: getAdminDashboardAbsoluteUrl({
          inputParams,
          timeGateway,
          dashboardGateway,
        }),
        name: inputParams.name,
      };
    },
  );

const getAdminDashboardAbsoluteUrl = ({
  inputParams,
  timeGateway,
  dashboardGateway,
}: {
  inputParams: GetDashboardParams;
  timeGateway: TimeGateway;
  dashboardGateway: DashboardGateway;
}): AbsoluteUrl => {
  if (inputParams.name === "conventionStatus")
    return dashboardGateway.getConventionStatusUrl(
      inputParams.conventionId,
      timeGateway.now(),
    );

  if (inputParams.name === "establishmentRepresentativeConventions")
    throw errors.dashboard.establishmentConventionForbidden();

  return dashboardGateway.getAdminDashboardUrl(
    inputParams.name,
    timeGateway.now(),
  );
};
