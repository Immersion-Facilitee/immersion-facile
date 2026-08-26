import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { includes, keys } from "ramda";
import {
  type ElementRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader,
  MainWrapper,
  PageHeader,
  SectionAccordion,
  SectionHighlight,
  SectionTextEmbed,
  useScrollTo,
} from "react-design-system";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useDispatch } from "react-redux";
import { domElementIds, type ValueOf } from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import { PlaceAutocomplete } from "src/app/components/forms/autocomplete/PlaceAutocomplete";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { SearchInfoSection } from "src/app/components/search/SearchInfoSection";
import { SearchListResults } from "src/app/components/search/SearchListResults";
import { useGetAcquisitionParams } from "src/app/hooks/acquisition.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  encodedSearchUriParams,
  type SearchRoute,
  useSearch,
} from "src/app/hooks/search.hooks";
import {
  areValidGeoParams,
  canSubmitSearch,
} from "src/app/pages/search/SearchPage.utils";
import labonneboiteLogoUrl from "src/assets/img/logo-lbb-centered.png";
import { featureFlagSelectors } from "src/core-logic/domain/featureFlags/featureFlags.selector";
import { geosearchSlice } from "src/core-logic/domain/geosearch/geosearch.slice";
import { nafSlice } from "src/core-logic/domain/naf/naf.slice";
import { searchSelectors } from "src/core-logic/domain/search/search.selectors";
import {
  type SearchPageParams,
  searchSlice,
} from "src/core-logic/domain/search/search.slice";
import { useStyles } from "tss-react/dsfr";
import "./SearchPage.scss";
import {
  isKeyInObjectAndValueNotUndefinedNorEmpty,
  isValueUndefinedOrEmpty,
} from "src/app/utils/url.utils";
import Styles from "./SearchPage.styles";

export const radiusOptions = ["1", "2", "5", "10", "20", "50", "100"].map(
  (distance) => ({
    label: `${distance} km`,
    value: distance,
  }),
);
export const DEFAULT_DISTANCE_KM = 10;

const getSearchRouteParam = (
  currentKey: keyof SearchPageParams,
  currentValue: ValueOf<SearchPageParams>,
  defaultValue: unknown,
) => {
  if (isValueUndefinedOrEmpty(currentValue)) {
    return defaultValue;
  }
  return includes(currentKey, encodedSearchUriParams)
    ? decodeURIComponent(`${currentValue}`)
    : currentValue;
};

const parisLatLon = {
  latitude: 48.8566,
  longitude: 2.3522,
};
const parisDistanceKm = 10;
const defaultValuesForExternalSearch: Required<
  Pick<
    SearchPageParams,
    "latitude" | "longitude" | "distanceKm" | "place" | "appellations"
  >
> = {
  latitude: parisLatLon.latitude,
  longitude: parisLatLon.longitude,
  distanceKm: parisDistanceKm,
  place: "Paris, France",
  appellations: [
    {
      romeCode: "J1501",
      appellationCode: "10891",
      romeLabel: "Aide-soignant / Aide-soignante",
      appellationLabel: "Aide-soignant / Aide-soignante",
    },
  ],
};

export const appellationInputLabel = (
  useNaturalLanguageForAppellations?: boolean,
) =>
  useNaturalLanguageForAppellations
    ? "Que souhaitez-vous faire ou découvrir ?"
    : "Je recherche le métier...";

export const appellationHintText = (
  useNaturalLanguageForAppellations?: boolean,
) =>
  useNaturalLanguageForAppellations
    ? "Un métier, un domaine ou une activité qui vous intéresse"
    : "Un métier qui vous intéresse";

export const appellationPlaceholder = (
  useNaturalLanguageForAppellations?: boolean,
) =>
  useNaturalLanguageForAppellations
    ? "Boulanger, comptabilité, travailler avec des enfants..."
    : "Ex : Boulanger, styliste, etc";

export const radiusHintText = "Affinez votre localisation";

export const placeHintText = "Une ville, un département, une région, etc.";

export const placeInputLabel = "Dans quelle ville ?";

export const SearchPage = ({
  route,
  useNaturalLanguageForAppellations,
  isExternal,
}: {
  route: SearchRoute;
  useNaturalLanguageForAppellations?: boolean;
  isExternal: boolean;
}) => {
  const { cx } = useStyles();
  const dispatch = useDispatch();
  const { pagination } = useAppSelector(
    searchSelectors.searchResultsWithPagination,
  );
  const isLoading = useAppSelector(searchSelectors.isLoading);
  const { navigateToSearch } = useSearch(route);
  const [searchMade, setSearchMade] = useState<SearchPageParams | null>(null);
  const searchResultsWrapper = useRef<ElementRef<"div">>(null);
  const innerSearchResultWrapper = useRef<ElementRef<"div">>(null);
  const acquisitionParams = useGetAcquisitionParams();
  const { enableSearchByScore } = useAppSelector(
    featureFlagSelectors.featureFlagState,
  );
  const initialValues: SearchPageParams = useMemo(
    () => ({
      sortBy: enableSearchByScore ? "score" : "date",
      sortOrder: "desc",
      distanceKm: isExternal
        ? defaultValuesForExternalSearch.distanceKm
        : undefined,
      latitude: isExternal
        ? defaultValuesForExternalSearch.latitude
        : undefined,
      longitude: isExternal
        ? defaultValuesForExternalSearch.longitude
        : undefined,
      fitForDisabledWorkers: undefined,
      nafCodes: undefined,
      nafLabel: undefined,
      page: 1,
      perPage: 24,
      appellations: isExternal
        ? defaultValuesForExternalSearch.appellations
        : undefined,
      place: isExternal ? defaultValuesForExternalSearch.place : undefined,
      appellationCodes: isExternal
        ? defaultValuesForExternalSearch.appellations.map(
            (appellation) => appellation.appellationCode,
          )
        : undefined,
      remoteWorkModes: undefined,
      showOnlyAvailableOffers: true,
      ...acquisitionParams,
    }),
    [enableSearchByScore, isExternal, acquisitionParams],
  );

  const [tempValue, setTempValue] = useState<SearchPageParams>(initialValues);
  const filterFormValues = useCallback((values: SearchPageParams) => {
    return keys(values).reduce((acc, key) => {
      const shouldKeepValue = isKeyInObjectAndValueNotUndefinedNorEmpty(
        key,
        values,
      );
      return {
        ...acc,
        ...(shouldKeepValue ? { [key]: values[key] } : {}),
      };
    }, {} as SearchPageParams);
  }, []);
  const routeParams = route.params as Partial<SearchPageParams>;
  const buildValuesFromRouteParams = useCallback(
    (paramsFromRoute: Partial<SearchPageParams>): SearchPageParams =>
      keys(initialValues).reduce(
        (acc, currentKey) => ({
          ...acc,
          [currentKey]: getSearchRouteParam(
            currentKey,
            paramsFromRoute[currentKey],
            initialValues[currentKey],
          ),
        }),
        initialValues,
      ),
    [initialValues],
  );
  const methods = useForm<SearchPageParams>({
    defaultValues: buildValuesFromRouteParams(routeParams),
    mode: "onTouched",
  });
  const { handleSubmit, setValue, control, getValues, reset } = methods;
  const formValues = getValues();
  const [lat, lon, distanceKm, place] = useWatch({
    control,
    name: ["latitude", "longitude", "distanceKm", "place"],
  });

  const searchHasBeenMade = searchMade !== null;

  const onSearchFormSubmit = useCallback(
    (updatedValues: SearchPageParams) => {
      navigateToSearch(filterFormValues(updatedValues));
    },
    [navigateToSearch, filterFormValues],
  );

  useScrollTo(pagination?.currentPage ?? 1);

  useEffect(() => {
    if (keys(routeParams).length === 0) return;
    const valuesFromUrl = buildValuesFromRouteParams(routeParams);
    if (!canSubmitSearch(valuesFromUrl)) return;
    setSearchMade(valuesFromUrl);
    reset(valuesFromUrl);
    dispatch(
      searchSlice.actions.getOffersRequested({
        ...filterFormValues(valuesFromUrl),
        isExternal,
      }),
    );
  }, [
    routeParams,
    buildValuesFromRouteParams,
    filterFormValues,
    reset,
    dispatch,
    isExternal,
  ]);

  useEffect(() => {
    return () => {
      setSearchMade(null);
      dispatch(
        geosearchSlice.actions.emptyQueryRequested({
          locator: "search-form-place",
        }),
      );
    };
  }, [dispatch]);

  useEffect(() => {
    dispatch(nafSlice.actions.getAllSectionsRequested());
  }, [dispatch]);

  return (
    <HeaderFooterLayout>
      <MainWrapper vSpacing={0} layout="fullscreen">
        {!searchHasBeenMade ? (
          <>
            <PageHeader
              title={
                route.name === "search"
                  ? "Trouver une immersion"
                  : "Trouver un stage"
              }
              breadcrumbs={<Breadcrumbs />}
            >
              <p>Dans une entreprise ou une administration publique</p>
              <form
                onSubmit={handleSubmit((value) =>
                  onSearchFormSubmit(filterFormValues(value)),
                )}
                className={cx(
                  fr.cx(
                    "fr-grid-row",
                    "fr-grid-row--gutters",
                    "fr-grid-row--bottom",
                  ),
                  Styles.form,
                  Styles.formV2,
                )}
                id={domElementIds[route.name].searchForm}
              >
                <div className={cx(fr.cx("fr-col-12", "fr-col-lg-4"))}>
                  <AppellationAutocomplete
                    locator="search-form-appellation"
                    label={appellationInputLabel(
                      useNaturalLanguageForAppellations,
                    )}
                    hintText={appellationHintText(
                      useNaturalLanguageForAppellations,
                    )}
                    onAppellationSelected={(appellation) => {
                      setValue("appellations", [appellation]);
                      setValue("appellationCodes", [
                        appellation.appellationCode,
                      ]);
                    }}
                    onAppellationClear={() => {
                      setValue("appellations", undefined);
                      setValue("appellationCodes", undefined);
                    }}
                    selectProps={{
                      inputId:
                        domElementIds[route.name].appellationAutocomplete,
                      placeholder: appellationPlaceholder(
                        useNaturalLanguageForAppellations,
                      ),
                    }}
                  />
                </div>
                <div className={cx(fr.cx("fr-col-12", "fr-col-lg-4"))}>
                  <PlaceAutocomplete
                    locator="search-form-place"
                    label={placeInputLabel}
                    initialInputValue={place}
                    hintText="Une ville, un département, une région, etc."
                    onPlaceSelected={(lookupSearchResult) => {
                      if (!lookupSearchResult) return;
                      setValue("latitude", lookupSearchResult.position.lat);
                      setValue("longitude", lookupSearchResult.position.lon);
                      setValue("place", lookupSearchResult.label);
                      if (!formValues.distanceKm) {
                        setValue("distanceKm", DEFAULT_DISTANCE_KM);
                      }
                    }}
                    selectProps={{
                      inputId: domElementIds[route.name].placeAutocompleteInput,
                    }}
                    onPlaceClear={() => {
                      setValue("latitude", initialValues.latitude);
                      setValue("longitude", initialValues.latitude);
                      setValue("place", initialValues.place);
                      if (formValues.sortBy === "distance") {
                        setValue("sortBy", "date");
                      }
                      setValue("distanceKm", initialValues.distanceKm);
                    }}
                  />
                </div>
                <div className={cx(fr.cx("fr-col-12", "fr-col-lg-2"))}>
                  <Select
                    label="Dans un rayon de :"
                    hint={radiusHintText}
                    options={radiusOptions}
                    disabled={!lat || !lon}
                    nativeSelectProps={{
                      title:
                        !lat || !lon
                          ? "Pour sélectionner une distance, vous devez d'abord définir une ville."
                          : undefined,
                      id: domElementIds[route.name].distanceSelect,
                      value: `${distanceKm === undefined ? DEFAULT_DISTANCE_KM : distanceKm}`,
                      onChange: (event) => {
                        const value = Number.parseInt(
                          event.currentTarget.value,
                          10,
                        );
                        setValue("distanceKm", value);
                        if (!value) {
                          setValue("sortBy", "date");
                        }
                      },
                    }}
                  />
                </div>

                <div className={cx(fr.cx("fr-col-12", "fr-col-lg-2"))}>
                  <Button
                    type="submit"
                    nativeButtonProps={{
                      id: domElementIds[route.name].searchSubmitButton,
                    }}
                    disabled={!canSubmitSearch(formValues)}
                  >
                    Rechercher
                  </Button>
                </div>
              </form>
            </PageHeader>

            <div className={fr.cx("fr-pt-6w", "fr-mt-6w", "fr-hr")}>
              <SearchInfoSection />
              <SectionAccordion />
              <SectionTextEmbed
                videoUrl="https://immersion.cellar-c2.services.clever-cloud.com/video_immersion_en_entreprise.mp4"
                videoPosterUrl="https://immersion.cellar-c2.services.clever-cloud.com/video_immersion_en_entreprise_poster.webp"
                videoDescription="https://immersion.cellar-c2.services.clever-cloud.com/video_immersion_en_entreprise_transcript.vtt"
                videoTranscription="https://immersion.cellar-c2.services.clever-cloud.com/video_immersion_en_entreprise_transcript.txt"
              />
            </div>
          </>
        ) : (
          <>
            {isLoading && <Loader />}
            <Breadcrumbs />
            {isExternal && (
              <div className={fr.cx("fr-container", "fr-mb-4w")}>
                <SectionHighlight
                  className={fr.cx(
                    "fr-grid-row",
                    "fr-grid-row--gutters",
                    "fr-grid-row--middle",
                  )}
                >
                  <div className={fr.cx("fr-col-12", "fr-col-lg-2")}>
                    <img src={labonneboiteLogoUrl} alt="La Bonne Boite" />
                  </div>
                  <div className={fr.cx("fr-col-12", "fr-col-lg-10")}>
                    <h1 className={fr.cx("fr-h3", "fr-mb-1w")}>
                      Vos résultats La Bonne Boite
                    </h1>
                    <p className={fr.cx("fr-text--md", "fr-mb-0")}>
                      Voici{" "}
                      <strong>
                        {pagination.totalRecords} entreprises à fort potentiel
                        d’embauche
                      </strong>{" "}
                      provenant de{" "}
                      <a
                        href="https://labonneboite.francetravail.fr/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        La Bonne Boite
                      </a>
                      .
                    </p>
                  </div>
                </SectionHighlight>
              </div>
            )}
            <FormProvider {...methods}>
              <form
                onSubmit={handleSubmit((value) => {
                  if (tempValue !== null) {
                    const updatedValues: SearchPageParams = {
                      ...value,
                      ...tempValue,
                    };
                    onSearchFormSubmit(updatedValues);
                  }
                })}
                className={cx(Styles.searchFilters)}
                id={domElementIds[route.name].searchForm}
              >
                <div ref={searchResultsWrapper}>
                  {searchMade !== null && (
                    <div
                      ref={innerSearchResultWrapper}
                      className={fr.cx("fr-pb-1w")}
                    >
                      <SearchListResults
                        route={route}
                        showDistance={areValidGeoParams(searchMade)}
                        isExternal={route.name === "externalSearch"}
                        onSearchFormSubmit={onSearchFormSubmit}
                        useNaturalLanguageForAppellations={
                          useNaturalLanguageForAppellations
                        }
                        tempValue={tempValue}
                        setTempValue={setTempValue}
                      />
                    </div>
                  )}
                </div>
              </form>
            </FormProvider>
          </>
        )}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};
