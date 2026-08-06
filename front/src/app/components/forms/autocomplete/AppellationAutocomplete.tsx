import { useState } from "react";
import {
  RSAutocomplete,
  type RSAutocompleteComponentProps,
} from "react-design-system";
import { useDispatch } from "react-redux";
import type { AppellationAndRomeDto } from "shared";
import { getAutocompleteValue } from "src/app/components/forms/autocomplete/autocomplete.utils";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { makeAppellationLocatorSelector } from "src/core-logic/domain/appellation/appellation.selectors";
import {
  type AppellationAutocompleteLocator,
  appellationSlice,
} from "src/core-logic/domain/appellation/appellation.slice";

export type AppellationAutocompleteProps = RSAutocompleteComponentProps<
  "appellation",
  AppellationAndRomeDto,
  AppellationAutocompleteLocator
>;

const useAppellationAutocomplete = (
  locator: AppellationAutocompleteLocator,
) => {
  const appellationLocatorSelector = useAppSelector(
    makeAppellationLocatorSelector(locator),
  );
  const options = (appellationLocatorSelector?.suggestions ?? []).map(
    (suggestion) => ({
      value: suggestion,
      label: suggestion.appellationLabel,
    }),
  );
  const value = appellationLocatorSelector?.value;
  const isSearching = appellationLocatorSelector?.isLoading;
  const isDebouncing = appellationLocatorSelector?.isDebouncing;
  return {
    value,
    options,
    isSearching,
    isDebouncing,
  };
};

export const AppellationAutocomplete = ({
  onAppellationClear,
  onAppellationSelected,
  initialInputValue,
  ...props
}: AppellationAutocompleteProps) => {
  const dispatch = useDispatch();
  const [searchTerm, setSearchTerm] = useState<string>(initialInputValue ?? "");
  const { value, options, isSearching, isDebouncing } =
    useAppellationAutocomplete(props.locator);
  const defaultValue = props.selectProps?.defaultValue;

  return (
    <RSAutocomplete
      {...props}
      selectProps={{
        isDebouncing,
        inputId: props.selectProps?.inputId ?? "im-select__input--appellation",
        isLoading: isSearching,
        loadingMessage: () => <>Recherche de métiers en cours... 🔎</>,
        inputValue: searchTerm,
        placeholder:
          props.selectProps?.placeholder ?? "Ex : Boulanger, styliste, etc.",
        value: getAutocompleteValue(
          (value) => value.appellationLabel,
          value,
          defaultValue,
          searchTerm,
        ),
        onChange: (searchResult, actionMeta) => {
          if (
            actionMeta.action === "clear" ||
            actionMeta.action === "remove-value"
          ) {
            dispatch(
              appellationSlice.actions.clearLocatorDataRequested({
                locator: props.locator,
              }),
            );
            onAppellationClear();
          }
          if (searchResult && actionMeta.action === "select-option") {
            onAppellationSelected(searchResult.value);
            dispatch(
              appellationSlice.actions.selectSuggestionRequested({
                item: searchResult.value,
                locator: props.locator,
              }),
            );
            dispatch(
              appellationSlice.actions.emptyQueryRequested({
                locator: props.locator,
              }),
            );
          }
        },
        options,
        onInputChange: (newQuery) => {
          setSearchTerm(newQuery);
          dispatch(
            appellationSlice.actions.changeQueryRequested({
              locator: props.locator,
              lookup: newQuery,
            }),
          );
        },
      }}
    />
  );
};
