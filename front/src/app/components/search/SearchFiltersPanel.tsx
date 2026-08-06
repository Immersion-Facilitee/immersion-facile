import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import Select from "@codegouvfr/react-dsfr/SelectNext";
import type { ReactNode } from "react";
import { useStyleUtils } from "react-design-system";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  fitForDisabledWorkersPositiveOptions,
  remoteWorkModeLabels,
  remoteWorkModes,
} from "shared";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import { PlaceAutocomplete } from "src/app/components/forms/autocomplete/PlaceAutocomplete";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { SearchRoute } from "src/app/hooks/search.hooks";
import {
  appellationPlaceholder,
  DEFAULT_DISTANCE_KM,
  placeHintText,
  placeInputLabel,
  radiusHintText,
  radiusOptions,
} from "src/app/pages/search/SearchPage";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";
import { geosearchSlice } from "src/core-logic/domain/geosearch/geosearch.slice";
import { nafSelectors } from "src/core-logic/domain/naf/naf.selectors";
import {
  minimalInitialSearchParams,
  type SearchPageParams,
} from "src/core-logic/domain/search/search.slice";
import "./SearchFiltersPanel.scss";
import {
  getAppellationAndNafValues,
  getEstablishmentAdditionalValues,
  getLocalisationValues,
} from "src/app/pages/search/SearchPage.utils";

type SearchFilterPanelProps = {
  appellationInputLabel: ReactNode;
  useNaturalLanguageForAppellations?: boolean;
  routeName: SearchRoute["name"];
  isPanelOpened: boolean;
  setIsPanelOpened: (isOpened: boolean) => void;
  appellationHintText: string;
  onSearchFormSubmit: (updatedValues: SearchPageParams) => void;
};

export const SearchFiltersPanel = ({
  appellationInputLabel,
  useNaturalLanguageForAppellations,
  routeName,
  appellationHintText,
  onSearchFormSubmit,
  isPanelOpened,
  setIsPanelOpened,
}: SearchFilterPanelProps) => {
  const {
    clearErrors,
    getValues,
    register,
    formState: { errors },
    watch,
  } = useFormContext<SearchPageParams>();
  const dispatch = useDispatch();
  const formValues = getValues();
  const [place] = watch(["place"]);
  const nafOptions = useAppSelector(nafSelectors.allSections);
  const { cx } = useStyleUtils();
  const clearAppellations = () => {
    dispatch(
      appellationSlice.actions.clearLocatorDataRequested({
        locator: "search-form-appellation",
      }),
    );
    onSearchFormSubmit({
      ...formValues,
      appellations: undefined,
      appellationCodes: undefined,
    });
  };

  return (
    <aside
      aria-labelledby="search-filters-panel-title"
      className={cx(
        fr.cx("fr-p-2w", "fr-p-md-0"),
        "im-search-filters-panel",
        isPanelOpened && "im-search-filters-panel--opened",
      )}
    >
      <Button
        priority="tertiary"
        className={cx(
          fr.cx("fr-mb-2w"),
          "im-search-filters-panel__close-button",
        )}
        onClick={() => setIsPanelOpened(false)}
        type="button"
        size="small"
      >
        Fermer
      </Button>
      <h3
        className={fr.cx("fr-h5", "fr-mb-1w")}
        id="search-filters-panel-title"
      >
        Affiner la recherche
      </h3>
      <Button
        priority="tertiary"
        className={fr.cx("fr-mb-2w")}
        onClick={() => {
          dispatch(
            appellationSlice.actions.clearLocatorDataRequested({
              locator: "search-form-appellation",
            }),
          );
          dispatch(
            geosearchSlice.actions.clearLocatorDataRequested({
              locator: "search-form-place",
            }),
          );
          onSearchFormSubmit(minimalInitialSearchParams);
        }}
        size="small"
        id={domElementIds[routeName].resetFiltersButton}
      >
        Réinitialiser la recherche
      </Button>
      <FilterSection
        title={
          <>
            Métier ou secteur d'activité{" "}
            <SearchFilterCounter
              value={
                getAppellationAndNafValues(
                  formValues.appellationCodes,
                  formValues.nafCodes,
                ).length
              }
            />
          </>
        }
        id={domElementIds[routeName].appellationAutocomplete}
      >
        <AppellationAutocomplete
          locator="search-form-appellation"
          className={fr.cx("fr-mb-2w")}
          label={appellationInputLabel}
          hintText={appellationHintText}
          onAppellationSelected={(appellation) => {
            clearErrors("appellations");
            onSearchFormSubmit({
              ...formValues,
              appellations: [appellation],
              appellationCodes: [appellation.appellationCode],
            });
          }}
          onAppellationClear={clearAppellations}
          selectProps={{
            inputId: domElementIds[routeName].appellationAutocomplete,
            placeholder: appellationPlaceholder(
              useNaturalLanguageForAppellations,
            ),
            defaultValue: formValues.appellations?.[0]
              ? {
                  label: formValues.appellations[0].appellationLabel,
                  value: formValues.appellations[0],
                }
              : undefined,
          }}
          state={errors.appellations ? "error" : undefined}
          stateRelatedMessage={errors.appellations?.message}
        />
        {formValues.appellations?.length && (
          <p className={fr.cx("fr-hint-text", "fr-mt-2w")}>
            <strong>
              Les résultats seront étendus aux autres métiers du secteur "
              {formValues.appellations[0].romeLabel}"
            </strong>
            , c’est pour cela que vous pourrez voir des métiers proches mais ne
            correspondant pas précisément à votre recherche dans les résultats.
          </p>
        )}
        <Select
          label="Et / ou un secteur d'activité"
          options={nafOptions.map((option) => ({
            label: option.label,
            value: JSON.stringify({
              nafLabel: option.label,
              nafCodes: option.nafCodes,
            }),
          }))}
          nativeSelectProps={{
            id: domElementIds[routeName].nafAutocomplete,
            value:
              formValues.nafLabel && formValues.nafCodes
                ? JSON.stringify({
                    nafLabel: formValues.nafLabel,
                    nafCodes: formValues.nafCodes,
                  })
                : "",
            onChange: (event) => {
              const value = event.currentTarget.value;
              if (!value) {
                onSearchFormSubmit({
                  ...formValues,
                  nafCodes: undefined,
                  nafLabel: undefined,
                });
                return;
              }
              const { nafLabel, nafCodes } = JSON.parse(value);
              onSearchFormSubmit({
                ...formValues,
                nafCodes,
                nafLabel,
              });
            },
          }}
        />
      </FilterSection>

      <FilterSection
        title={
          <>
            Lieu d'immersion{" "}
            <SearchFilterCounter
              value={
                getLocalisationValues(
                  formValues.place,
                  formValues.remoteWorkModes,
                ).length
              }
            />
          </>
        }
        id={domElementIds[routeName].filterLocationSection}
      >
        <PlaceAutocomplete
          locator="search-form-place"
          label={placeInputLabel}
          hintText={placeHintText}
          onPlaceSelected={(lookupSearchResult) => {
            clearErrors("place");
            if (!lookupSearchResult) return;
            const newValues = {
              place: lookupSearchResult.label,
              latitude: lookupSearchResult.position.lat,
              longitude: lookupSearchResult.position.lon,
            };
            onSearchFormSubmit({
              ...formValues,
              ...newValues,
              distanceKm: formValues.distanceKm || DEFAULT_DISTANCE_KM,
            });
          }}
          onPlaceClear={() => {
            dispatch(
              geosearchSlice.actions.clearLocatorDataRequested({
                locator: "search-form-place",
              }),
            );

            onSearchFormSubmit({
              ...formValues,
              place: undefined,
              latitude: undefined,
              longitude: undefined,
              distanceKm: undefined,
              sortBy:
                formValues.sortBy === "distance" ? "score" : formValues.sortBy,
            });
          }}
          className={fr.cx("fr-mt-2w")}
          initialInputValue={place}
          selectProps={{
            inputId: domElementIds[routeName].placeAutocompleteInput,
            defaultValue:
              place && formValues.latitude && formValues.longitude
                ? {
                    label: place,
                    value: {
                      label: place,
                      position: {
                        lat: formValues.latitude,
                        lon: formValues.longitude,
                      },
                    },
                  }
                : undefined,
          }}
          state={errors.place ? "error" : undefined}
          stateRelatedMessage={errors.place?.message}
        />

        <Select
          label="Dans un rayon de :"
          options={radiusOptions}
          disabled={!formValues.latitude || !formValues.longitude}
          hint={radiusHintText}
          nativeSelectProps={{
            ...register("distanceKm"),
            title:
              !formValues.latitude || !formValues.longitude
                ? "Pour sélectionner une distance, vous devez d'abord définir une ville."
                : undefined,
            id: domElementIds[routeName].distanceSelect,
            value: `${formValues.distanceKm || ""}`,
            onChange: (event) => {
              const value = Number.parseInt(event.currentTarget.value, 10);
              onSearchFormSubmit({
                ...formValues,
                distanceKm: value,
              });
              if (!value) {
                onSearchFormSubmit({
                  ...formValues,
                  distanceKm: value,
                });
              }
            },
          }}
        />
        <p className={fr.cx("fr-text--bold", "fr-mt-2w")}>
          Quelle(s) offre(s) souhaitez-vous voir ?
        </p>
        <Checkbox
          options={remoteWorkModes.map((mode) => ({
            label: remoteWorkModeLabels[mode].label,
            nativeInputProps: {
              checked: formValues.remoteWorkModes?.includes(mode),
              onChange: () => {
                const remoteWorkModesArray = formValues.remoteWorkModes || [];
                onSearchFormSubmit({
                  ...formValues,
                  remoteWorkModes: formValues.remoteWorkModes?.includes(mode)
                    ? remoteWorkModesArray.filter((m) => m !== mode)
                    : [...remoteWorkModesArray, mode],
                });
              },
            },
          }))}
        />
      </FilterSection>

      <FilterSection
        title={
          <>
            Conditions d'accueil{" "}
            <SearchFilterCounter
              value={
                getEstablishmentAdditionalValues(
                  formValues.fitForDisabledWorkers,
                  formValues.showOnlyAvailableOffers,
                ).length
              }
            />
          </>
        }
        id={domElementIds[routeName].filterConditionsSection}
      >
        <Checkbox
          className={fr.cx("fr-mb-2w")}
          options={[
            {
              label: rqthLabel,
              hintText:
                "Entreprises ayant indiqué être ouvertes à l'accueil de ces profils lors de l'inscription",
              nativeInputProps: {
                checked:
                  formValues.fitForDisabledWorkers?.some(
                    (fitForDisabledWorker) =>
                      fitForDisabledWorker === "yes-declared-only" ||
                      fitForDisabledWorker === "yes-ft-certified",
                  ) ?? false,
                onChange: (event) => {
                  onSearchFormSubmit({
                    ...formValues,
                    fitForDisabledWorkers: event.currentTarget.checked
                      ? [...fitForDisabledWorkersPositiveOptions]
                      : ["no"],
                  });
                },
              },
            },
          ]}
        />
        <Checkbox
          className={fr.cx("fr-mb-2w")}
          options={[
            {
              label: "Mises en relation disponibles",
              hintText:
                "Entreprises n'ayant pas atteint leur limite de mise en relation",
              nativeInputProps: {
                checked: formValues.showOnlyAvailableOffers,
                onChange: (event) => {
                  onSearchFormSubmit({
                    ...formValues,
                    showOnlyAvailableOffers: event.currentTarget.checked,
                  });
                },
              },
            },
          ]}
        />
      </FilterSection>
    </aside>
  );
};

const FilterSection = ({ title, children, id }: FilterSectionProps) => {
  return (
    <section id={id}>
      <h2 className={fr.cx("fr-h6")}>{title}</h2>
      {children}
      <hr className={fr.cx("fr-hr", "fr-mt-2w")} />
    </section>
  );
};

const rqthLabel = "Personnes en situation de handicap bienvenues";

type FilterSectionProps = {
  title: ReactNode;
  children: ReactNode;
  id: string;
};

const SearchFilterCounter = ({ value }: { value: number }) => {
  const { cx } = useStyleUtils();
  if (value === 0) return null;
  return (
    <span
      className={cx(
        fr.cx("fr-px-1w", "fr-text--xs", "fr-text--bold"),
        "im-search-filter-counter",
      )}
    >
      {value}
    </span>
  );
};
