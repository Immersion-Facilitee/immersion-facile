import {
  type AgencyUserForListing,
  type ConnectedUser,
  errors,
  type GetAgencyUsersFilters,
  getAgencyUsersFiltersSchema,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { throwIfNotAgencyAdminOrBackofficeAdmin } from "../helpers/authorization.helper";
import {
  getAgencyUsersByUserIds,
  sortUsersByName,
} from "../helpers/connectedUser.helper";

export type GetAgencyUsers = ReturnType<typeof makeGetAgencyUsers>;
export const makeGetAgencyUsers = useCaseBuilder("GetAgencyUsers")
  .withInput(getAgencyUsersFiltersSchema)
  .withCurrentUser<ConnectedUser>()
  .withOutput<AgencyUserForListing[]>()
  .build(async ({ uow, currentUser, inputParams: filters }) => {
    throwIfNotAgencyAdminOrBackofficeAdmin({
      agencyIds: filters.agencyIds,
      currentUser,
    });
    throwIfRequestingToReviewUsersOnNeedsReviewAgency(filters, currentUser);

    const userIds =
      await uow.agencyRepository.getUserIdWithAgencyRightsByFilters(filters);

    const users = await getAgencyUsersByUserIds(
      uow,
      userIds,
      filters.agencyIds,
    );

    return sortUsersByName(users);
  });

const throwIfRequestingToReviewUsersOnNeedsReviewAgency = (
  filters: GetAgencyUsersFilters,
  currentUser: ConnectedUser,
): void => {
  if (filters.agencyRole !== "to-review") return;

  const hasNeedsReviewAgency = filters.agencyIds.some((agencyId) => {
    const agencyRight = currentUser.agencyRights.find(
      (right) => right.agency.id === agencyId,
    );
    return agencyRight?.agency.status === "needsReview";
  });

  if (hasNeedsReviewAgency)
    throw errors.agency.cannotGetToReviewUsersWhenNeedsReview();
};
