import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import type { SiretEstablishmentDto } from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { AddressAutocompleteLocator } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";

export const useSiretRelatedField = <K extends keyof SiretEstablishmentDto>(
  fieldFromInfo: K,
  options?: {
    fieldToUpdate?: string;
    disabled?: boolean;
  },
) => {
  const fieldNameToUpdate = options?.fieldToUpdate ?? fieldFromInfo;
  const establishmentInfos = useAppSelector(siretSelectors.establishmentInfos);
  const { setValue } = useFormContext();
  useEffect(() => {
    if (establishmentInfos && !options?.disabled) {
      setValue(fieldNameToUpdate, establishmentInfos?.[fieldFromInfo], {
        shouldValidate: true,
      });
    }
  }, [
    establishmentInfos,
    setValue,
    options?.disabled,
    fieldNameToUpdate,
    fieldFromInfo,
  ]);
};

type SiretFetcherOptions = {
  shouldThrowErrorOnAlreadySaved: boolean;
  addressAutocompleteLocator: AddressAutocompleteLocator | null;
};

export const useSiretFetcher = ({
  shouldThrowErrorOnAlreadySaved,
  addressAutocompleteLocator,
}: SiretFetcherOptions) => {
  const currentSiret = useAppSelector(siretSelectors.currentSiret);
  const establishmentInfos = useAppSelector(siretSelectors.establishmentInfos);
  const siretErrorToDisplay = useAppSelector(
    siretSelectors.siretErrorToDisplay,
  );
  const siretRawError = useAppSelector(siretSelectors.siretRawError);
  const isFetching = useAppSelector(siretSelectors.isFetching);
  const storeShouldThrowErrorOnAlreadySaved = useAppSelector(
    siretSelectors.shouldThrowErrorOnAlreadySaved,
  );
  const dispatch = useDispatch();

  useEffect(() => {
    if (shouldThrowErrorOnAlreadySaved !== storeShouldThrowErrorOnAlreadySaved)
      dispatch(
        siretSlice.actions.setShouldThrowErrorOnAlreadySaved({
          shouldThrowErrorOnAlreadySaved,
          addressAutocompleteLocator,
        }),
      );
    return () => {
      if (
        shouldThrowErrorOnAlreadySaved === storeShouldThrowErrorOnAlreadySaved
      ) {
        dispatch(siretSlice.actions.siretInfoClearRequested());
      }
    };
  }, [
    storeShouldThrowErrorOnAlreadySaved,
    shouldThrowErrorOnAlreadySaved,
    addressAutocompleteLocator,
    dispatch,
  ]);

  return {
    currentSiret,
    establishmentInfos: establishmentInfos ?? undefined,
    isFetchingSiret: isFetching,
    siretErrorToDisplay: siretErrorToDisplay ?? undefined,
    siretRawError,
    updateSiret: (newSiret: string) => {
      dispatch(
        siretSlice.actions.siretModified({
          feedbackTopic: "siret-input",
          siret: newSiret,
          addressAutocompleteLocator,
        }),
      );
    },
  };
};
