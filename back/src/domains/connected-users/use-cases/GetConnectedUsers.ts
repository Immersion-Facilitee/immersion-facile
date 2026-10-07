import { type ConnectedUser, withUserFiltersSchema } from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { throwIfNotAdmin } from "../helpers/authorization.helper";
import {
  getConnectedUsersByUserIds,
  sortUsersByName,
} from "../helpers/connectedUser.helper";

export type GetConnectedUsers = ReturnType<typeof makeGetConnectedUsers>;
export const makeGetConnectedUsers = useCaseBuilder("GetConnectedUsers")
  .withInput(withUserFiltersSchema)
  .withCurrentUser<ConnectedUser>()
  .withOutput<ConnectedUser[]>()
  .build(async ({ uow, currentUser, inputParams: filters }) => {
    throwIfNotAdmin(currentUser);

    const userIds =
      await uow.agencyRepository.getUserIdWithAgencyRightsByFilters(filters);

    const users = await getConnectedUsersByUserIds(
      uow,
      userIds,
      filters.agencyIds ?? [],
    );

    return sortUsersByName(users);
  });
