import type { ZodSchemaWithInputMatchingOutput } from "shared";
import { z } from "zod";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import { useCaseBuilder } from "../../core/useCaseBuilder";

const markOldConventionAsDeprecatedSchema: ZodSchemaWithInputMatchingOutput<{
  deprecateSince: Date;
}> = z.object({
  deprecateSince: z.date(),
});

export type MarkOldConventionAsDeprecated = ReturnType<
  typeof makeMarkOldConventionAsDeprecated
>;
export const makeMarkOldConventionAsDeprecated = useCaseBuilder(
  "MarkOldConventionAsDeprecated",
)
  .withInput(markOldConventionAsDeprecatedSchema)
  .withDeps<{
    createNewEvent: CreateNewEvent;
  }>()
  .build(async ({ uow, deps, inputParams }) => {
    const updatedConventionsIds =
      await uow.conventionRepository.deprecateConventionsWithoutDefinitiveStatusEndedSince(
        inputParams.deprecateSince,
        "La convention n'a jamais été validée, et la date de fin d'immersion indiquée est dépassée depuis un mois.",
      );

    const conventions = await uow.conventionQueries.getConventions({
      filters: { ids: updatedConventionsIds },
      sortBy: "dateStart",
    });

    await uow.outboxRepository.saveNewEventsBatch(
      conventions
        .filter((convention) => convention !== undefined)
        .map((convention) =>
          deps.createNewEvent({
            topic: "ConventionDeprecated",
            payload: { convention, triggeredBy: { kind: "crawler" } },
          }),
        ),
    );

    return {
      numberOfUpdatedConventions: conventions.filter(
        (convention) => convention !== undefined,
      ).length,
    };
  });
