import {
  type ConnectedUser,
  errors,
  type WithAgencyIdAndUserId,
  withAgencyIdAndUserIdSchema,
} from "shared";
import {
  rejectIfEditionOfValidatorsOfAgencyWithRefersTo,
  validateAgencyRights,
} from "../../connected-users/helpers/agencyRights.helper";
import { throwIfNotAgencyAdminOrBackofficeAdmin } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type RemoveUserFromAgency = ReturnType<typeof makeRemoveUserFromAgency>;

export const makeRemoveUserFromAgency = useCaseBuilder("RemoveUserFromAgency")
  .withInput<WithAgencyIdAndUserId>(withAgencyIdAndUserIdSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ createNewEvent: CreateNewEvent }>()
  .build(
    async ({ currentUser, uow, inputParams: { agencyId, userId }, deps }) => {
      const isUserHimself = currentUser.id === userId;
      if (!isUserHimself)
        throwIfNotAgencyAdminOrBackofficeAdmin({
          agencyIds: [agencyId],
          currentUser,
        });

      const user = await uow.userRepository.getById(userId);
      if (!user) throw errors.user.notFound({ userId });

      const agency = await uow.agencyRepository.getById(agencyId);
      if (!agency) throw errors.agency.notFound({ agencyId });

      const userRight = agency.usersRights[userId];
      if (!userRight)
        throw errors.user.expectedRightsOnAgency({
          agencyId,
          userId: user.id,
        });

      rejectIfEditionOfValidatorsOfAgencyWithRefersTo(agency, userRight.roles);

      const { [user.id]: _, ...usersRights } = agency.usersRights;

      validateAgencyRights(agency.id, usersRights, agency.refersToAgencyId);

      await uow.agencyRepository.update({
        id: agency.id,
        status: agency.status,
        usersRights,
      });

      await uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "ConnectedUserAgencyRightChanged",
          payload: {
            userId,
            agencyId,
            triggeredBy: {
              kind: "connected-user",
              userId: currentUser.id,
            },
          },
        }),
      );
    },
  );
