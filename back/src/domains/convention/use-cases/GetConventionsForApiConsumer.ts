import {
  type ApiConsumer,
  type ConventionReadDto,
  conventionStatuses,
  ForbiddenError,
  localization,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import { conventionDtosToConventionReadDtos } from "../../../utils/convention";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { GetConventionsFilters } from "../ports/ConventionQueries";

const MAX_CONVENTIONS_RETURNED = 100;

const inputSchema: ZodSchemaWithInputMatchingOutput<GetConventionsFilters> =
  z.object({
    startDateGreater: z.date().optional(),
    startDateLessOrEqual: z.date().optional(),
    withStatuses: z
      .array(
        z.enum(conventionStatuses, {
          error: localization.invalidEnum,
        }),
      )
      .optional(),
  });

export type GetConventionsForApiConsumer = ReturnType<
  typeof makeGetConventionsForApiConsumer
>;

export const makeGetConventionsForApiConsumer = useCaseBuilder(
  "GetConventionsForApiConsumer",
)
  .withInput(inputSchema)
  .withOutput<ConventionReadDto[]>()
  .withCurrentUser<ApiConsumer>()
  .build(async ({ inputParams: filters, uow, currentUser: apiConsumer }) => {
    if (!apiConsumer) throw new ForbiddenError("No api consumer provided");

    const { scope } = apiConsumer.rights.convention;

    const agencyIds =
      scope.agencyIds ??
      (scope.agencyKinds?.length
        ? await uow.agencyRepository.getAgencyIdsByFilters({
            kinds: scope.agencyKinds,
          })
        : []);

    if (!agencyIds.length) return [];

    const conventions = await uow.conventionQueries.getConventions({
      filters: { ...filters, agencyIds },
      sortBy: "dateStart",
      limit: MAX_CONVENTIONS_RETURNED,
    });

    return conventionDtosToConventionReadDtos(conventions, uow);
  });
