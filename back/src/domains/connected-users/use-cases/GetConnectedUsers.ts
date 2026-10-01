import {
  type ConnectedUser,
  errors,
  type WithUserFilters,
  withUserFiltersSchema,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  throwIfNotAdmin,
  throwIfNotAgencyAdminOrBackofficeAdmin,
} from "../helpers/authorization.helper";
import { getConnectedUsersByUserIds } from "../helpers/connectedUser.helper";

export type GetConnectedUsers = ReturnType<typeof makeGetConnectedUsers>;
export const makeGetConnectedUsers = useCaseBuilder("GetConnectedUsers")
  .withInput(withUserFiltersSchema)
  .withCurrentUser<ConnectedUser>()
  .withOutput<ConnectedUser[]>()
  .build(async ({ uow, currentUser, inputParams: filters }) => {
    throwIfNotAuthorized(filters, currentUser);
    throwIfRequestingToReviewUsersOnNeedsReviewAgency(filters, currentUser);

    const userIds =
      await uow.agencyRepository.getUserIdWithAgencyRightsByFilters(filters);

    const users = await getConnectedUsersByUserIds(
      uow,
      userIds,
      filters.agencyIds ?? [],
    );

    return users.sort((a, b) => {
      const firstNameA = a.firstName.trim();
      const firstNameB = b.firstName.trim();

      const isAEmpty = firstNameA === "";
      const isBEmpty = firstNameB === "";

      if (isAEmpty !== isBEmpty) return isAEmpty ? -1 : 1;
      if (isAEmpty && isBEmpty) return a.email.localeCompare(b.email);

      const compareFirstName = firstNameA.localeCompare(firstNameB);
      return compareFirstName !== 0
        ? compareFirstName
        : a.lastName.trim().localeCompare(b.lastName.trim());
    });
  });

const throwIfNotAuthorized = (
  filters: WithUserFilters,
  currentUser: ConnectedUser,
): void => {
  if (filters.agencyIds) {
    throwIfNotAgencyAdminOrBackofficeAdmin({
      agencyIds: filters.agencyIds,
      currentUser,
    });
    return;
  }
  throwIfNotAdmin(currentUser);
};

const throwIfRequestingToReviewUsersOnNeedsReviewAgency = (
  filters: WithUserFilters,
  currentUser: ConnectedUser,
): void => {
  if (filters.agencyRole !== "to-review" || !filters.agencyIds?.length) return;

  const hasNoNeedsReviewAgency = filters.agencyIds.every((agencyId) => {
    const agencyRight = currentUser.agencyRights.find(
      (right) => right.agency.id === agencyId,
    );
    return agencyRight?.agency.status !== "needsReview";
  });

  if (!hasNoNeedsReviewAgency)
    throw errors.agency.cannotGetToReviewUsersWhenNeedsReview();
};
