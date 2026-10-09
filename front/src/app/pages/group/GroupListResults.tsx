import { fr } from "@codegouvfr/react-dsfr";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { useState } from "react";
import {
  Tag as ImTag,
  SearchResultIllustration,
  useScrollTo,
} from "react-design-system";
import { domElementIds, frontRoutes, type InternalOfferDto } from "shared";
import { SearchResult } from "src/app/components/search/SearchResult";
import { searchIllustrations } from "src/assets/img/illustrations";

type GroupListResultsProps = {
  parentContainerIdToScrollToTop: string;
  results: InternalOfferDto[];
};

export const GroupListResults = ({
  results,
  parentContainerIdToScrollToTop,
}: GroupListResultsProps) => {
  const resultsPerPageOptions = ["6", "12", "24", "48"] as const;
  type ResultsPerPageOptions = (typeof resultsPerPageOptions)[number];

  const defaultResultsPerPage: ResultsPerPageOptions = "12";
  const initialPage = 1;
  const isResultPerPageOption = (
    value: string,
  ): value is ResultsPerPageOptions =>
    resultsPerPageOptions.includes(value as ResultsPerPageOptions);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [resultsPerPage, setResultsPerPage] = useState<ResultsPerPageOptions>(
    defaultResultsPerPage,
  );
  const resultsPerPageValue = Number.parseInt(resultsPerPage);
  const totalPages = Math.ceil(results.length / resultsPerPageValue);
  const getSearchResultsForPage = (currentPage: number): InternalOfferDto[] => {
    const start = (currentPage - 1) * resultsPerPageValue;
    const end = start + resultsPerPageValue;
    return results.slice(start, end);
  };

  useScrollTo(currentPage, parentContainerIdToScrollToTop);

  return (
    <>
      <div className={fr.cx("fr-container")}>
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          {getSearchResultsForPage(currentPage).map((searchResult) => {
            const appellationCode =
              searchResult.appellations.length &&
              searchResult.appellations[0]?.appellationCode;
            if (!appellationCode) return null;
            return (
              <div
                className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}
                key={`${searchResult.siret}-${searchResult.rome}`}
              >
                <SearchResult
                  mode="list"
                  illustration={
                    <SearchResultIllustration
                      illustration={searchIllustrations[0]}
                    >
                      <div className={fr.cx("fr-p-1v")}>
                        {searchResult.fitForDisabledWorkers && (
                          <ImTag theme="rqth" />
                        )}
                        {!searchResult.voluntaryToImmersion && (
                          <ImTag theme="lbb" />
                        )}
                        {searchResult.voluntaryToImmersion && (
                          <ImTag theme="voluntaryToImmersion" />
                        )}
                      </div>
                    </SearchResultIllustration>
                  }
                  searchResult={searchResult}
                  linkProps={
                    frontRoutes.searchResult({
                      appellationCode: [appellationCode],
                      siret: searchResult.siret,
                      location: searchResult.locationId ?? undefined,
                    }).link
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className={fr.cx("fr-container", "fr-mb-10w")}>
        <div
          className={fr.cx("fr-grid-row", "fr-grid-row--middle", "fr-mt-4w")}
        >
          <div className={fr.cx("fr-col-10", "fr-grid-row")}>
            <Pagination
              showFirstLast
              count={totalPages}
              defaultPage={currentPage}
              getPageLinkProps={(pageNumber) => ({
                title: `Résultats de recherche, page : ${pageNumber}`,
                onClick: (event) => {
                  event.preventDefault();
                  setCurrentPage(pageNumber);
                },
                href: "#",
                key: `pagination-link-${pageNumber + 1}`,
              })}
              className={fr.cx("fr-mt-1w")}
            />
          </div>
          <div
            className={fr.cx("fr-col-2", "fr-grid-row", "fr-grid-row--right")}
          >
            <Select
              label=""
              options={[
                ...resultsPerPageOptions.map((number) => ({
                  label: `${number} résultats / page`,
                  value: number,
                })),
              ]}
              nativeSelectProps={{
                id: domElementIds.search.resultPerPageDropdown,
                onChange: (event) => {
                  const value = event.currentTarget?.value;
                  if (isResultPerPageOption(value)) {
                    setResultsPerPage(value);
                  }
                },
                value: resultsPerPage,
                "aria-label": "Nombre de résultats par page",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
