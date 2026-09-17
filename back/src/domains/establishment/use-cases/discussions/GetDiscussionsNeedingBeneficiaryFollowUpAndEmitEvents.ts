import { subDays } from "date-fns";
import { uniq } from "ramda";
import type { CreateNewEvent } from "../../../core/events/ports/EventBus";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { isEstablishmentReachableByPhoneAfter15Days } from "../../helpers/establishment.utils";

export type GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents = ReturnType<
  typeof makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents
>;

const MAX_DISCUSSIONS_TO_NOTIFY = 5000;
const daysBeforeBeneficiaryFollowUp = 15;

export const makeGetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents =
  useCaseBuilder("GetDiscussionsNeedingBeneficiaryFollowUpAndEmitEvents")
    .withOutput<{ numberOfDiscussionsToFollowUp: number }>()
    .withDeps<{
      timeGateway: TimeGateway;
      createNewEvent: CreateNewEvent;
    }>()
    .build(async ({ uow, deps }) => {
      const now = deps.timeGateway.now();

      const discussionsWithoutEstablishmentAnswer =
        await uow.discussionRepository.getDiscussions({
          filters: {
            status: "PENDING",
            contactMode: "EMAIL",
            answeredByEstablishment: false,
            createdBetween: {
              from: subDays(now, daysBeforeBeneficiaryFollowUp + 1),
              to: subDays(now, daysBeforeBeneficiaryFollowUp),
            },
          },
          limit: MAX_DISCUSSIONS_TO_NOTIFY,
        });

      if (discussionsWithoutEstablishmentAnswer.length === 0)
        return { numberOfDiscussionsToFollowUp: 0 };

      const establishments =
        await uow.establishmentAggregateRepository.getEstablishmentAggregatesByFilters(
          {
            sirets: uniq(
              discussionsWithoutEstablishmentAnswer.map(({ siret }) => siret),
            ),
          },
        );

      const siretsReachableByPhone = new Set(
        establishments
          .filter(isEstablishmentReachableByPhoneAfter15Days)
          .map(({ establishment }) => establishment.siret),
      );

      const discussionsToFollowUp =
        discussionsWithoutEstablishmentAnswer.filter(({ siret }) =>
          siretsReachableByPhone.has(siret),
        );

      await uow.outboxRepository.saveNewEventsBatch(
        discussionsToFollowUp.map(({ id }) =>
          deps.createNewEvent({
            topic: "DiscussionBeneficiaryFollowUpRequested",
            payload: {
              discussionId: id,
              triggeredBy: { kind: "crawler" },
            },
          }),
        ),
      );

      return { numberOfDiscussionsToFollowUp: discussionsToFollowUp.length };
    });
