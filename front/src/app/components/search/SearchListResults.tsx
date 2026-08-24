import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Card from "@codegouvfr/react-dsfr/Card";
import { Pagination } from "@codegouvfr/react-dsfr/Pagination";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { useState } from "react";
import {
  Tag as ImTag,
  RichDropdown,
  SearchResultIllustration,
  useLayout,
  useStyleUtils,
} from "react-design-system";
import { useFormContext } from "react-hook-form";
import {
  type AppellationCode,
  domElementIds,
  frontRoutes,
  hasSearchGeoParams,
  isSuperEstablishment,
  type OfferDto,
  type SearchSortedBy,
  searchSortedByOptions,
} from "shared";
import { SearchFiltersPanel } from "src/app/components/search/SearchFiltersPanel";
import { SearchMiniMap } from "src/app/components/search/SearchMiniMap";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { type SearchRoute, useSearch } from "src/app/hooks/search.hooks";
import {
  appellationHintText,
  appellationInputLabel,
} from "src/app/pages/search/SearchPage";
import {
  areValidGeoParams,
  getAppellationAndNafValues,
  getEstablishmentAdditionalValues,
  getLocalisationValues,
  getSortedByOptions,
  sortedByOptionsLabel,
} from "src/app/pages/search/SearchPage.utils";
import { filterParamsForRoute } from "src/app/utils/url.utils";
import { searchIllustrations } from "src/assets/img/illustrations";
import labonneboiteLogoUrl from "src/assets/img/logo-lbb-on-left.png";
import { featureFlagSelectors } from "src/core-logic/domain/featureFlags/featureFlags.selector";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import type { SearchPageParams } from "src/core-logic/domain/search/search.slice";
import type { Link } from "type-route";
import { SearchResult } from "./SearchResult";

type ResultsPerPageOption = (typeof resultsPerPageOptions)[number];

const resultsPerPageOptions = ["1", "6", "12", "24", "48"] as const;

export const SearchListResults = ({
  showDistance,
  route,
  isExternal,
  onSearchFormSubmit,
  useNaturalLanguageForAppellations,
}: {
  tempValue: SearchPageParams;
  setTempValue: (updatedValues: SearchPageParams) => void;
  route: SearchRoute;
  showDistance: boolean;
  isExternal: boolean;
  onSearchFormSubmit: (
    searchParams: ReturnType<typeof searchSelectors.searchParams>,
  ) => void;
  useNaturalLanguageForAppellations?: boolean;
}) => {
  const { triggerSearch } = useSearch(route);
  const { data: searchResults, pagination } = useAppSelector(
    searchSelectors.searchResultsWithPagination,
  );
  const { isLayoutDesktop } = useLayout();

  const { enableSearchByScore } = useAppSelector(
    featureFlagSelectors.featureFlagState,
  );
  const { getValues, register, reset } = useFormContext<SearchPageParams>();
  const formValues = getValues();
  const searchParams = useAppSelector(searchSelectors.searchParams);
  const [isPanelOpened, setIsPanelOpened] = useState(false);
  const { cx, classes } = useStyleUtils();
  const { totalPages, currentPage, numberPerPage } = pagination;
  const hasResults = searchResults.length > 0;
  const isLastPage = currentPage === totalPages;
  const isSearchWithAppellation =
    searchParams.appellations && searchParams.appellations.length > 0;
  const isSearchWithGeoParams = hasSearchGeoParams(searchParams);
  const isSearchWithAppellationAndGeoParams =
    isSearchWithGeoParams && isSearchWithAppellation;
  const shouldShowLaBonneBoiteCTA =
    !isExternal &&
    hasResults &&
    isLastPage &&
    isSearchWithAppellationAndGeoParams;
  const displayTotalFiltersLength = (formValues: SearchPageParams): string => {
    const currentFiltersLength = [
      ...getAppellationAndNafValues(
        formValues.appellationCodes,
        formValues.nafCodes,
      ),
      ...getEstablishmentAdditionalValues(
        formValues.fitForDisabledWorkers,
        formValues.showOnlyAvailableOffers,
      ),
      ...getLocalisationValues(formValues.place, formValues.remoteWorkModes),
    ].length;
    return currentFiltersLength > 0 ? `(${currentFiltersLength})` : "";
  };

  const numberOfColumns = 6;
  const filteredSortOptions = getSortedByOptions(
    areValidGeoParams(formValues),
    enableSearchByScore.isActive,
  );

  return (
    <div className={fr.cx("fr-container", isExternal && "fr-mb-8w")}>
      <div
        className={fr.cx(
          "fr-grid-row",
          "fr-grid-row--gutters",
          !hasResults && "fr-grid-row--center",
        )}
      >
        <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
          <SearchFiltersPanel
            appellationInputLabel={appellationInputLabel(
              useNaturalLanguageForAppellations,
            )}
            routeName={route.name}
            isPanelOpened={isPanelOpened}
            setIsPanelOpened={setIsPanelOpened}
            appellationHintText={appellationHintText(
              useNaturalLanguageForAppellations,
            )}
            onSearchFormSubmit={onSearchFormSubmit}
          />
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          {!isExternal && isLayoutDesktop && (
            <div
              className={cx(fr.cx("fr-mb-2w"), "search-map-results__summary")}
            >
              <h2 className={fr.cx("fr-h5", "fr-mb-0")}>
                <strong>{pagination.totalRecords}</strong> résultat
                {pagination.totalRecords > 1 ? "s" : ""} trouvé
                {pagination.totalRecords > 1 ? "s" : ""}
              </h2>
              {searchParams.appellations &&
                searchParams.appellations.length > 0 && (
                  <span className={cx(fr.cx("fr-text--xs"))}>
                    pour la recherche{" "}
                    <a
                      href={`https://candidat.francetravail.fr/metierscope/fiche-metier/${searchParams.appellations[0].romeCode}`}
                      target="_blank"
                      className={fr.cx("fr-text--bold")}
                      rel="noreferrer"
                    >
                      {searchParams.appellations[0].appellationLabel}
                    </a>
                  </span>
                )}
            </div>
          )}
          <div className={fr.cx("fr-grid-row", "fr-mb-2w")}>
            <RichDropdown
              defaultValue="Trier par pertinence"
              iconId="fr-icon-arrow-down-line"
              id={domElementIds[route.name].sortFilterTag}
              values={
                formValues.sortBy
                  ? [sortedByOptionsLabel[formValues.sortBy]]
                  : []
              }
              noButtons
              submenu={{
                title: "Ordre d’affichage",
                content: (
                  <RadioButtons
                    id={domElementIds[route.name].sortRadioButtons}
                    options={filteredSortOptions.map((option) => ({
                      ...option,
                      nativeInputProps: {
                        name: register("sortBy").name,
                        value: option.value,
                        disabled: option.disabled,
                        checked: formValues.sortBy
                          ? option.value === formValues.sortBy
                          : false,
                        onClick: (event) => {
                          const updatedSortedBy = isSearchSortedBy(
                            event.currentTarget.value,
                          )
                            ? event.currentTarget.value
                            : "score";
                          if (
                            updatedSortedBy === "distance" &&
                            areValidGeoParams(formValues)
                          ) {
                            onSearchFormSubmit({
                              ...formValues,
                              sortBy: "distance",
                            });
                          }
                          if (updatedSortedBy !== "distance") {
                            onSearchFormSubmit({
                              ...formValues,
                              sortBy: updatedSortedBy,
                            });
                          }
                        },
                      },
                    }))}
                  />
                ),
              }}
            />
            {isLayoutDesktop && (
              <SearchMiniMap kind="list" isExternal={isExternal} />
            )}
            <Button
              iconId="fr-icon-filter-line"
              priority="secondary"
              className={fr.cx("fr-hidden-lg", "fr-ml-auto")}
              size="small"
              type="button"
              onClick={() => {
                setIsPanelOpened(true);
              }}
            >
              Filtrer {displayTotalFiltersLength(formValues)}
            </Button>
          </div>
          <div
            className={fr.cx(
              "fr-grid-row",
              "fr-grid-row--gutters",
              !hasResults && "fr-grid-row--center",
            )}
          >
            {!hasResults && isExternal && (
              <div
                className={cx(
                  fr.cx(
                    `fr-col-${isExternal && !isSearchWithAppellationAndGeoParams ? "8" : "6"}`,
                    "fr-py-6w",
                  ),
                  classes["text-centered"],
                )}
              >
                <p className={fr.cx("fr-h6")}>
                  {isExternal && !isSearchWithAppellationAndGeoParams
                    ? "Votre recherche n'a pas abouti car vous n'avez pas sélectionné de métier ou de ville."
                    : "Aucun résultat ne correspond à votre recherche 😓"}
                </p>
                <p>
                  {isExternal && !isSearchWithAppellationAndGeoParams
                    ? "Sélectionnez une ville et un métier pour trouver des entreprises à fort potentiel d'embauche."
                    : "Vous pouvez essayer d'élargir votre recherche en augmentant le rayon de recherche ou en sélectionnant un métier."}
                </p>
              </div>
            )}
            {!hasResults && !isExternal && (
              <div className={cx(fr.cx("fr-p-6w"), classes["text-centered"])}>
                <p className={fr.cx("fr-h6")}>
                  Nous n'avons pas trouvé d'entreprises actuellement disponibles
                  correspondant à votre recherche 🥺
                </p>

                {searchParams.showOnlyAvailableOffers ? (
                  <>
                    <p>
                      Certaines entreprises peuvent être temporairement masquées
                      lorsqu’elles ont déjà reçu le maximum de candidatures
                      qu’elles peuvent traiter.
                    </p>
                    <p>
                      Vous pouvez afficher toutes les entreprises et revenir
                      dans quelques semaines, lorsque de nouvelles places seront
                      disponibles ou découvrir d’autres opportunités à votre
                      potentiel d’embauche grâce à notre partenaire La Bonne
                      Boîte.
                    </p>
                    <ButtonsGroup
                      inlineLayoutWhen="always"
                      alignment="center"
                      buttons={[
                        {
                          children: "Afficher toutes les entreprises",
                          priority: "secondary",
                          id: domElementIds.search.noResultsAvailabilityButton,
                          onClick: () => {
                            onSearchFormSubmit({
                              ...searchParams,
                              showOnlyAvailableOffers: false,
                            });
                          },
                        },
                        {
                          children: "Rechercher sur La Bonne Boite",
                          id: domElementIds.search.noResultsLbbButton,
                          onClick: () => {
                            onSearchFormSubmit({
                              ...searchParams,
                              showOnlyAvailableOffers: false,
                            });
                          },
                        },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <p>
                      Découvrez d'autres opportunités d'entreprise à fort
                      potentiel d'embauche grâce à notre partenaire La Bonne
                      Boîte !
                    </p>
                    <Button
                      id={domElementIds.search.noResultsLbbButton}
                      linkProps={
                        frontRoutes.externalSearch(
                          getFilteredSearchParamsForLBB(searchParams),
                        ).link
                      }
                      priority="primary"
                    >
                      Rechercher sur La Bonne Boîte
                    </Button>
                  </>
                )}
              </div>
            )}
            {hasResults &&
              searchResults.map((searchResult, index) => {
                const appellations = searchResult.appellations;
                const searchResultAppellationCode = appellations?.length
                  ? appellations[0].appellationCode
                  : null;
                const appellationCode =
                  searchResultAppellationCode ||
                  searchParams.appellationCodes?.[0];
                return (
                  <div
                    className={fr.cx(
                      "fr-col-12",
                      `fr-col-md-${numberOfColumns}`,
                      `fr-col-lg-${numberOfColumns}`,
                    )}
                    key={`${searchResult.siret}-${searchResult.rome}-${searchResult.locationId}`}
                  >
                    <SearchResult
                      searchResult={searchResult}
                      illustration={
                        <SearchResultIllustration
                          illustration={
                            searchIllustrations[
                              index % searchIllustrations.length
                            ]
                          }
                        >
                          <div className={fr.cx("fr-p-1v")}>
                            {isSuperEstablishment(
                              searchResult.establishmentScore,
                            ) && <ImTag theme="superEnterprise" />}
                            {searchResult.fitForDisabledWorkers ===
                              "yes-ft-certified" && (
                              <ImTag
                                theme="rqth"
                                label="Reconnue handi-engagée"
                              />
                            )}
                            {searchResult.fitForDisabledWorkers ===
                              "yes-declared-only" && <ImTag theme="rqth" />}
                            {!searchResult.voluntaryToImmersion && (
                              <ImTag theme="lbb" />
                            )}
                          </div>
                        </SearchResultIllustration>
                      }
                      showDistance={showDistance}
                      linkProps={makeOfferLink(
                        route,
                        searchResult,
                        appellationCode,
                      )}
                    />
                  </div>
                );
              })}
            {shouldShowLaBonneBoiteCTA && (
              <LaBonneBoiteCallToAction searchParams={searchParams} />
            )}
          </div>
          {!isExternal && (
            <div className={fr.cx("fr-container", "fr-mb-10w")}>
              <div
                className={fr.cx(
                  "fr-grid-row",
                  "fr-grid-row--middle",
                  "fr-mt-4w",
                )}
              >
                <div className={fr.cx("fr-col-9", "fr-grid-row")}>
                  <Pagination
                    showFirstLast
                    count={totalPages}
                    defaultPage={currentPage}
                    getPageLinkProps={(pageNumber) => ({
                      title: `Résultats de recherche, page : ${pageNumber}`,
                      onClick: (event) => {
                        event.preventDefault();
                        reset({
                          ...searchParams,
                          page: pageNumber,
                        });
                        triggerSearch(
                          {
                            ...searchParams,
                            page: pageNumber,
                          },
                          isExternal,
                        );
                      },
                      href: "#", // TODO : PR vers react-dsfr pour gérer pagination full front
                      key: `pagination-link-${pageNumber}`,
                    })}
                    className={fr.cx("fr-mt-1w")}
                  />
                </div>
                <div
                  className={fr.cx(
                    "fr-col-3",
                    "fr-grid-row",
                    "fr-grid-row--right",
                  )}
                >
                  <Select
                    label=""
                    options={[
                      ...resultsPerPageOptions.map((numberAsString) => ({
                        label: `${numberAsString} / page`,
                        value: numberAsString,
                      })),
                    ]}
                    nativeSelectProps={{
                      id: domElementIds.search.resultPerPageDropdown,
                      onChange: (event) => {
                        const value = event.currentTarget.value;
                        triggerSearch(
                          {
                            ...searchParams,
                            perPage: Number.parseInt(value, 10),
                          },
                          isExternal,
                        );
                      },
                      value: numberPerPage.toString() as ResultsPerPageOption,
                      "aria-label": "Nombre de résultats par page",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const makeOfferLink = (
  route: SearchRoute,
  { siret, locationId, voluntaryToImmersion }: OfferDto,
  appellationCode?: AppellationCode,
): Link => {
  const definedAppellationCode: AppellationCode = appellationCode ?? "";
  if (!voluntaryToImmersion)
    return frontRoutes.searchResultExternal({
      siret,
      appellationCode: [definedAppellationCode],
    }).link;

  const searchParams = {
    appellationCode: [definedAppellationCode],
    siret,
    ...(locationId ? { location: locationId } : {}),
  };

  return route.name === "search" || route.name === "externalSearch"
    ? frontRoutes.searchResult(searchParams).link
    : frontRoutes.searchResultForStudent(searchParams).link;
};

const getFilteredSearchParamsForLBB = (
  searchParams: ReturnType<typeof searchSelectors.searchParams>,
) =>
  filterParamsForRoute({
    urlParams: searchParams,
    matchingParams: {
      distanceKm: undefined,
      latitude: undefined,
      longitude: undefined,
      place: undefined,
      appellations: undefined,
      nafCodes: undefined,
      nafLabel: undefined,
      appellationCodes: undefined,
      fitForDisabledWorkers: undefined,
    },
  });

const LaBonneBoiteCallToAction = ({
  searchParams,
}: {
  searchParams: ReturnType<typeof searchSelectors.searchParams>;
}) => {
  const filteredSearchParams = getFilteredSearchParamsForLBB(searchParams);
  return (
    <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-6")}>
      <Card
        id={domElementIds.search.noResultsLbbCard}
        imageUrl={labonneboiteLogoUrl}
        imageAlt="Logo de LaBonneBoite"
        title="Découvrez d'autres entreprises"
        desc="Explorez plus d'opportunités avec notre partenaire La Bonne Boite"
        footer={
          <Button
            linkProps={frontRoutes.externalSearch(filteredSearchParams).link}
            priority="primary"
          >
            Découvrez d'autres entreprises avec La Bonne Boite
          </Button>
        }
      />
    </div>
  );
};

const isSearchSortedBy = (value: string): value is SearchSortedBy =>
  searchSortedByOptions.includes(value as SearchSortedBy);
