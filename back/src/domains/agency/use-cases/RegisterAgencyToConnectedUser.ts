import {
  agencyIdsSchema,
  type ConnectedUser,
  errors,
  executeInSequence,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { isFTUser } from "../entities/Agency";

export type RegisterAgencyToConnectedUser = ReturnType<
  typeof makeRegisterAgencyToConnectedUser
>;
export const makeRegisterAgencyToConnectedUser = useCaseBuilder(
  "RegisterAgencyToConnectedUser",
)
  .withInput(agencyIdsSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ createNewEvent: CreateNewEvent; timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, deps, inputParams: agencyIds }) => {
    const agencyRights = await uow.agencyRepository.getAgenciesRightsByUserId(
      currentUser.id,
    );
    const alreadyHasRequestedAgencyRight = agencyRights.filter((agencyRight) =>
      agencyIds.includes(agencyRight.agencyId),
    ).length;
    if (alreadyHasRequestedAgencyRight) {
      throw errors.user.alreadyHaveAgencyRights({
        userId: currentUser.id,
      });
    }

    const agencies = await uow.agencyRepository.getByIds(agencyIds);

    const agencyWithKindFt = agencies.find(
      (agency) => agency.kind === "france-travail",
    );
    if (agencyWithKindFt && !isFTUser(currentUser))
      throw errors.agency.registerNotFtUserForbidden({
        user: currentUser,
        agency: agencyWithKindFt,
      });

    await executeInSequence(agencies, ({ id, status, usersRights }) =>
      uow.agencyRepository.update({
        id,
        status,
        usersRights: {
          ...usersRights,
          [currentUser.id]: {
            isNotifiedByEmail: false,
            roles: ["to-review"],
          },
        },
        updatedAt: deps.timeGateway.now().toISOString(),
      }),
    );
    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "AgencyRegisteredToConnectedUser",
        payload: {
          userId: currentUser.id,
          agencyIds,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
      }),
    );
  });
