import { subMonths } from "date-fns";
import { castError, executeInSequence, type SiretDto } from "shared";
import { createLogger } from "../../../utils/logger";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWorkPerformer } from "../../core/unit-of-work/ports/UnitOfWorkPerformer";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { SuggestEstablishmentReengagement } from "./SuggestEstablishmentReengagement";

const logger = createLogger(__filename);

const NB_MONTHS_BEFORE_SUGGEST = 6;

type Report = {
  numberOfEstablishmentsToContact: number;
  errors: Record<SiretDto, Error>;
};

export type SuggestEstablishmentReengagementsScript = ReturnType<
  typeof makeSuggestEstablishmentReengagementsScript
>;

export const makeSuggestEstablishmentReengagementsScript = useCaseBuilder(
  "SuggestEstablishmentReengagementsScript",
)
  .notTransactional()
  .withOutput<Report>()
  .withDeps<{
    suggestEstablishmentReengagement: SuggestEstablishmentReengagement;
    timeGateway: TimeGateway;
    uowPerformer: UnitOfWorkPerformer;
    batchSize: number;
    maxEstablishmentsToReengage: number;
  }>()
  .build(async ({ deps }) => {
    logger.info({
      message:
        "[triggerSuggestEstablishmentReengagementEvery6Months] Script started.",
    });
    const sixMonthsAgo = subMonths(
      deps.timeGateway.now(),
      NB_MONTHS_BEFORE_SUGGEST,
    );

    const errors: Record<SiretDto, Error> = {};
    let offset = 0;
    const siretsToContact: SiretDto[] = [];

    while (siretsToContact.length < deps.maxEstablishmentsToReengage) {
      const { candidateCount, batchSirets } = await deps.uowPerformer.perform(
        async (uow) => {
          const candidateSirets =
            await uow.establishmentAggregateRepository.getSiretsOfEstablishmentsNotUpdatedSince(
              {
                updatedBefore: sixMonthsAgo,
                limit: deps.batchSize,
                offset,
              },
            );
          if (candidateSirets.length === 0)
            return { candidateCount: 0, batchSirets: [] };

          const alreadySuggestedSirets =
            await uow.notificationRepository.filterEstablishmentSiretsAlreadySuggestedReengagement(
              { sirets: candidateSirets, suggestedSince: sixMonthsAgo },
            );
          const alreadySuggestedSet = new Set(alreadySuggestedSirets);

          return {
            candidateCount: candidateSirets.length,
            batchSirets: candidateSirets.filter(
              (siret) => !alreadySuggestedSet.has(siret),
            ),
          };
        },
      );

      const maxSiretsToTake =
        deps.maxEstablishmentsToReengage - siretsToContact.length;
      siretsToContact.push(...batchSirets.slice(0, maxSiretsToTake));

      if (candidateCount < deps.batchSize) break;
      offset += deps.batchSize;
    }

    if (siretsToContact.length > 0) {
      logger.info({
        message: `[triggerSuggestEstablishmentReengagementEvery6Months] Found ${
          siretsToContact.length
        } establishments not updated since ${sixMonthsAgo} to contact, with siret : ${siretsToContact.join(
          ", ",
        )}`,
      });

      await executeInSequence(siretsToContact, (siret) =>
        deps.suggestEstablishmentReengagement.execute(siret).catch((error) => {
          errors[siret] = castError(error);
        }),
      );
    }

    return { numberOfEstablishmentsToContact: siretsToContact.length, errors };
  });
