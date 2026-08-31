import {
  type ConnectedUser,
  errors,
  handleArchivedConventionRequestSchema,
} from "shared";
import { throwIfNotAdmin } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type HandleArchivedConventionRequest = ReturnType<
  typeof makeHandleArchivedConventionRequest
>;

export const makeHandleArchivedConventionRequest = useCaseBuilder(
  "HandleArchivedConventionRequest",
)
  .withInput(handleArchivedConventionRequestSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, inputParams, currentUser, deps }) => {
    throwIfNotAdmin(currentUser);

    const archivedConventionRequest =
      await uow.archivedConventionRequestRepository.getById(
        inputParams.archivedConventionRequestId,
      );

    if (!archivedConventionRequest)
      throw errors.archivedConventionRequest.notFound({
        id: inputParams.archivedConventionRequestId,
      });

    if (archivedConventionRequest.status !== "PENDING")
      throw errors.archivedConventionRequest.alreadyHandled({
        id: archivedConventionRequest.id,
      });

    const now = deps.timeGateway.now().toISOString();

    await uow.archivedConventionRequestRepository.update({
      id: inputParams.archivedConventionRequestId,
      status: inputParams.status,
      updatedAt: now,
    });

    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ArchivedConventionRequestHandled",
        payload: {
          archivedConventionRequestId: inputParams.archivedConventionRequestId,
          status: inputParams.status,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
      }),
    );
  });
