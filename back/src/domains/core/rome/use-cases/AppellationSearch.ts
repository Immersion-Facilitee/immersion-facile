import {
  type AppellationAndRomeDto,
  appellationSearchInputParamsSchema,
  ROME_AND_APPELLATION_MIN_SEARCH_TEXT_LENGTH,
} from "shared";
import type { UnitOfWork } from "../../unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { AppellationsGateway } from "../ports/AppellationsGateway";

export type AppellationSearch = ReturnType<typeof makeAppellationSearch>;

export const makeAppellationSearch = useCaseBuilder("AppellationSearch")
  .withInput(appellationSearchInputParamsSchema)
  .withOutput<AppellationAndRomeDto[]>()
  .withDeps<{ appellationsGateway: AppellationsGateway }>()
  .build(
    async ({
      inputParams: { searchText, fetchAppellationsFromNaturalLanguage },
      uow,
      deps: { appellationsGateway },
    }) =>
      searchText.length < ROME_AND_APPELLATION_MIN_SEARCH_TEXT_LENGTH
        ? []
        : naturalLanguageSearchAppellations(
            uow,
            searchText,
            appellationsGateway,
            fetchAppellationsFromNaturalLanguage,
          ).then((diagorienteAppellations) =>
            diagorienteAppellations.length > 0
              ? diagorienteAppellations
              : uow.romeRepository.searchAppellation(searchText),
          ),
  );

const naturalLanguageSearchAppellations = async (
  uow: UnitOfWork,
  searchText: string,
  appellationsGateway: AppellationsGateway,
  fetchAppellationsFromNaturalLanguage: boolean | undefined,
): Promise<AppellationAndRomeDto[]> =>
  fetchAppellationsFromNaturalLanguage === true
    ? appellationsGateway
        .searchAppellations(searchText)
        .then((appellations) =>
          appellations.length > 0
            ? uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
                appellations.map(({ appellationCode }) => appellationCode),
              )
            : [],
        )
    : [];
