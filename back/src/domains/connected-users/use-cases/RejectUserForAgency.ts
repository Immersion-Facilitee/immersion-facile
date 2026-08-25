import {
  type ConnectedUser,
  errors,
  rejectIcUserRoleForAgencyParamsSchema,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { throwIfNotAgencyAdminOrBackofficeAdmin } from "../helpers/authorization.helper";

export type RejectUserForAgency = ReturnType<typeof makeRejectUserForAgency>;
export const makeRejectUserForAgency = useCaseBuilder("RejectUserForAgency")
  .withInput(rejectIcUserRoleForAgencyParamsSchema)
  .withOutput<void>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, currentUser, deps, inputParams }) => {
    throwIfNotAgencyAdminOrBackofficeAdmin({
      agencyIds: [inputParams.agencyId],
      currentUser,
    });
    const userToUpdate = await uow.userRepository.getById(inputParams.userId);

    if (!userToUpdate)
      throw errors.user.notFound({ userId: inputParams.userId });

    const agency = await uow.agencyRepository.getById(inputParams.agencyId);

    if (!agency)
      throw errors.agency.notFound({ agencyId: inputParams.agencyId });

    const { [userToUpdate.id]: _, ...updatedUserRights } = agency.usersRights;

    await uow.agencyRepository.update({
      id: agency.id,
      status: agency.status,
      usersRights: updatedUserRights,
      updatedAt: deps.timeGateway.now().toISOString(),
    });
    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ConnectedUserAgencyRightRejected",
        payload: {
          ...inputParams,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
      }),
    );
  });
