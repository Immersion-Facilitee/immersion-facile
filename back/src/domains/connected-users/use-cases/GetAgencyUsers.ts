import {
  type AgencyId,
  type AgencyRole,
  type AgencyUserForListing,
  type ConnectedUser,
  errors,
  withUserFiltersSchema,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  throwIfNotAgencyAdminOrBackofficeAdmin,
  throwIfNotValidAgencyRole,
} from "../helpers/authorization.helper";
import {
  getAgencyUsersByUserIdsAndAgencyIds,
  sortUsersByName,
} from "../helpers/connectedUser.helper";

export type GetAgencyUsers = ReturnType<typeof makeGetAgencyUsers>;
export const makeGetAgencyUsers = useCaseBuilder("GetAgencyUsers")
  .withInput(withUserFiltersSchema)
  .withCurrentUser<ConnectedUser>()
  .withOutput<AgencyUserForListing[]>()
  .build(async ({ uow, currentUser, inputParams: filters }) => {
    const agencyIds = filters.agencyIds ?? [];

    if (!currentUser.isBackofficeAdmin && agencyIds.length === 0)
      throw errors.user.forbidden({ userId: currentUser.id });

    if (
      filters.agencyRole === "to-review" &&
      !currentUser.isBackofficeAdmin &&
      agencyIds.length === 1
    )
      throwIfNotValidAgencyRole({
        agencyId: agencyIds[0],
        currentUser,
      });
    else
      throwIfNotAgencyAdminOrBackofficeAdmin({
        agencyIds,
        currentUser,
      });

    if (!currentUser.isBackofficeAdmin)
      throwIfRequestingToReviewUsersOnNeedsReviewAgency({
        agencyIds,
        agencyRole: filters.agencyRole,
        currentUser,
      });

    const userIds =
      await uow.agencyRepository.getUserIdWithAgencyRightsByFilters(filters);

    const users = await getAgencyUsersByUserIdsAndAgencyIds(
      uow,
      userIds,
      agencyIds,
    );

    return sortUsersByName(users);
  });

const throwIfRequestingToReviewUsersOnNeedsReviewAgency = ({
  agencyIds,
  agencyRole,
  currentUser,
}: {
  agencyIds: AgencyId[];
  agencyRole?: AgencyRole;
  currentUser: ConnectedUser;
}): void => {
  if (agencyRole !== "to-review") return;

  const hasNeedsReviewAgency = agencyIds.some((agencyId) => {
    const agencyRight = currentUser.agencyRights.find(
      (right) => right.agency.id === agencyId,
    );
    return agencyRight?.agency.status === "needsReview";
  });

  if (hasNeedsReviewAgency)
    throw errors.agency.cannotGetToReviewUsersWhenNeedsReview();
};
