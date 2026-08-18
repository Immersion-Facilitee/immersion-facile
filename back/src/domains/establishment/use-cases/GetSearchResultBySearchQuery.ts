import {
  type ApiConsumer,
  errors,
  type InternalOfferDto,
  searchResultQuerySchema,
} from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentAggregateQueries } from "../ports/EstablishmentAggregateQueries";

export type GetSearchResultBySearchQuery = ReturnType<
  typeof makeGetSearchResultBySearchQuery
>;

export const makeGetSearchResultBySearchQuery = useCaseBuilder(
  "GetSearchResultBySearchQuery",
)
  .withInput(searchResultQuerySchema)
  .withOutput<InternalOfferDto>()
  .withCurrentUser<ApiConsumer | void>()
  .withDeps<{ establishmentAggregateQueries: EstablishmentAggregateQueries }>()
  .notTransactional()
  .build(
    async ({
      inputParams: { appellationCode, siret, locationId },
      deps: { establishmentAggregateQueries },
    }) => {
      const searchResult =
        await establishmentAggregateQueries.getSearchResultBySearchQuery(
          siret,
          appellationCode,
          locationId,
        );

      if (!searchResult)
        throw errors.establishment.offerMissing({
          appellationCode,
          siret,
          mode: "not found",
        });

      return searchResult;
    },
  );
