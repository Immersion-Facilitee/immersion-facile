import {
  type ArchivedConventionRequestId,
  errors,
  triggeredBySchema,
  type WithTriggeredBy,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

type NotifyUserThatArchivedConventionRequestWasReceivedParams = {
  archivedConventionRequestId: ArchivedConventionRequestId;
} & WithTriggeredBy;

const notifyUserThatArchivedConventionRequestWasReceivedSchema: ZodSchemaWithInputMatchingOutput<NotifyUserThatArchivedConventionRequestWasReceivedParams> =
  z.object({
    archivedConventionRequestId: z.uuid(),
    triggeredBy: triggeredBySchema,
  });

export type NotifyUserThatArchivedConventionRequestWasReceived = ReturnType<
  typeof makeNotifyUserThatArchivedConventionRequestWasReceived
>;

export const makeNotifyUserThatArchivedConventionRequestWasReceived =
  useCaseBuilder("NotifyUserThatArchivedConventionRequestWasReceived")
    .withInput(notifyUserThatArchivedConventionRequestWasReceivedSchema)
    .withDeps<{
      saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    }>()
    .build(
      async ({ inputParams: { archivedConventionRequestId }, uow, deps }) => {
        const archivedConventionRequest =
          await uow.archivedConventionRequestRepository.getById(
            archivedConventionRequestId,
          );
        if (!archivedConventionRequest)
          throw errors.archivedConventionRequest.notFound({
            id: archivedConventionRequestId,
          });

        const requester = await uow.userRepository.getById(
          archivedConventionRequest.userId,
        );
        if (!requester)
          throw errors.user.notFound({
            userId: archivedConventionRequest.userId,
          });

        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "ARCHIVED_CONVENTION_REQUEST_RECEIVED",
            recipients: [requester.email],
            params: {
              archivedConventionRequestId,
            },
          },
          followedIds: {
            userId: requester.id,
          },
        });
      },
    );
