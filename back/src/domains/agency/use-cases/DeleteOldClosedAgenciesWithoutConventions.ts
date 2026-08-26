import { subMonths } from "date-fns";
import { uniq } from "ramda";
import { type AgencyId, executeInSequence, isTruthy } from "shared";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type DeleteOldClosedAgenciesWithoutConventions = ReturnType<
  typeof makeDeleteOldClosedAgenciesWithoutConventions
>;

export const numberOfMonthsBeforeDeletion = 3;

export const makeDeleteOldClosedAgenciesWithoutConventions = useCaseBuilder(
  "DeleteOldClosedAgenciesWithoutConventions",
)
  .withOutput<{ deletedAgencies: AgencyId[] }>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ uow, deps: { timeGateway } }) => {
    const updatedBefore = subMonths(
      timeGateway.now(),
      numberOfMonthsBeforeDeletion,
    );

    const candidateAgencyIds = await uow.agencyRepository.getAgencyIdsByFilters(
      {
        statuses: ["closed", "rejected"],
        updateDate: { to: updatedBefore },
      },
    );

    const agenciesToDelete: AgencyId[] = await executeInSequence<
      AgencyId,
      AgencyId[] | null
    >(candidateAgencyIds, async (agencyId) => {
      const relatedAgencies =
        await uow.agencyRepository.getAgenciesRelatedToAgency(agencyId);

      const candidateAndRelatedAgencyIds = [
        agencyId,
        ...relatedAgencies.map(({ id }) => id),
      ];

      const conventionIds =
        await uow.conventionQueries.getConventionIdsByFilters({
          filters: {
            withAgencyIds: candidateAndRelatedAgencyIds,
          },
          limit: 1,
        });

      return conventionIds.length === 0 ? candidateAndRelatedAgencyIds : null;
    }).then((results) => uniq(results.filter(isTruthy).flat()));

    const deletedAgencies =
      await uow.agencyRepository.deleteByIds(agenciesToDelete);

    return { deletedAgencies };
  });
