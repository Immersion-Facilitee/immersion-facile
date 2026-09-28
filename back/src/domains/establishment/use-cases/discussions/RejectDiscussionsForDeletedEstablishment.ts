import { errors, executeInSequence, withSiretSchema } from "shared";
import { withTriggeredBySchema } from "../../../core/events/events";
import type { CreateNewEvent } from "../../../core/events/ports/EventBus";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type RejectDiscussionsForDeletedEstablishment = ReturnType<
  typeof makeRejectDiscussionsForDeletedEstablishment
>;

export const establishmentDeletedRejectionReason =
  "L'entreprise s'est désinscrite d'Immersion Facilitée";

const maxDiscussionsToReject = 500;

export const makeRejectDiscussionsForDeletedEstablishment = useCaseBuilder(
  "RejectDiscussionsForDeletedEstablishment",
)
  .withInput(withSiretSchema.and(withTriggeredBySchema))
  .withOutput<void>()
  .withDeps<{
    timeGateway: TimeGateway;
    createNewEvent: CreateNewEvent;
  }>()
  .build(async ({ deps, inputParams: { siret, triggeredBy }, uow }) => {
    const deletedEstablishmentsBySiret =
      await uow.deletedEstablishmentRepository.areSiretsDeleted([siret]);
    if (!deletedEstablishmentsBySiret[siret])
      throw errors.establishment.establishmentNotDeleted({ siret });

    const pendingDiscussions = await uow.discussionRepository.getDiscussions({
      filters: {
        sirets: [siret],
        status: "PENDING",
      },
      limit: maxDiscussionsToReject,
    });

    await executeInSequence(pendingDiscussions, async (discussion) => {
      const rejectedDiscussion = {
        ...discussion,
        status: "REJECTED" as const,
        rejectionKind: "OTHER" as const,
        rejectionReason: establishmentDeletedRejectionReason,
        updatedAt: deps.timeGateway.now().toISOString(),
      };

      await uow.discussionRepository.update(rejectedDiscussion);
      await uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "DiscussionRejectedOnEstablishmentDeleted",
          payload: {
            discussion: rejectedDiscussion,
            triggeredBy,
          },
        }),
      );
    });
  });
