import { archivedConventionRequestSchema, type ConnectedUser } from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { ArchivedConventionRequestEntity } from "../entities/ArchivedConventionRequestEntity";

export type CreateArchivedConventionRequest = ReturnType<
  typeof makeCreateArchivedConventionRequest
>;

export const makeCreateArchivedConventionRequest = useCaseBuilder(
  "CreateArchivedConventionRequest",
)
  .withInput(archivedConventionRequestSchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, inputParams, currentUser, deps }) => {
    const now = deps.timeGateway.now().toISOString();
    const archivedConventionRequestEntity: ArchivedConventionRequestEntity =
      inputParams.conventionSearchMethod === "withConventionId"
        ? {
            ...inputParams,
            userId: currentUser.id,
            createdAt: now,
            updatedAt: now,
            status: "PENDING",
          }
        : {
            ...inputParams,
            immersionAppellationCode:
              inputParams.immersionAppellation.appellationCode,
            userId: currentUser.id,
            createdAt: now,
            updatedAt: now,
            status: "PENDING",
          };

    await uow.archivedConventionRequestRepository.save(
      archivedConventionRequestEntity,
    );

    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "ArchivedConventionRequestCreated",
        payload: {
          archivedConventionRequestId: inputParams.id,
          triggeredBy: {
            kind: "connected-user",
            userId: currentUser.id,
          },
        },
      }),
    );
  });
