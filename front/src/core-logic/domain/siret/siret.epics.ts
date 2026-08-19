import { filter, map, switchMap } from "rxjs";
import {
  type GetSiretInfoError,
  getCountryCodeFromAddress,
  siretSchema,
} from "shared";
import {
  type SiretAction,
  siretSlice,
} from "src/core-logic/domain/siret/siret.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type { AppEpic } from "src/core-logic/storeConfig/redux.helpers";

type SiretEpic = AppEpic<SiretAction>;

const toggleShouldThrowErrorOnAlreadySaved: SiretEpic = (action$, state$) =>
  action$.pipe(
    filter(siretSlice.actions.setShouldThrowErrorOnAlreadySaved.match),
    map((action) =>
      siretSlice.actions.siretModified({
        siret: state$.value.siret.currentSiret,
        feedbackTopic: "siret-input",
        addressAutocompleteLocator: action.payload.addressAutocompleteLocator,
      }),
    ),
  );

const triggerSiretFetchEpic: SiretEpic = (action$) =>
  action$.pipe(
    filter(siretSlice.actions.siretModified.match),
    map((action) => {
      const isValid = siretSchema.safeParse(action.payload.siret).success;
      return isValid
        ? siretSlice.actions.siretInfoRequested(action.payload)
        : siretSlice.actions.siretWasNotValid();
    }),
  );

const getSiretEpic: SiretEpic = (
  action$,
  state$,
  { formCompletionGateway },
) => {
  return action$.pipe(
    filter(siretSlice.actions.siretInfoRequested.match),
    switchMap((action) =>
      formCompletionGateway
        .getSiretEstablishmentDtoResponse$(action.payload.siret)
        .pipe(
          map((siretResult) => {
            if (siretResult === null)
              return siretSlice.actions.siretInfoDisabledAndNoMatchInDbFound({
                siret: state$.value.siret.currentSiret,
              });
            if (typeof siretResult === "string")
              return siretSlice.actions.siretInfoFailed(siretResult);

            if (
              state$.value.siret.shouldThrowErrorOnAlreadySaved &&
              siretResult.isAlreadySaved
            )
              return siretSlice.actions.siretInfoFailed("Already exists");

            return siretSlice.actions.siretInfoSucceeded({
              siretEstablishment: siretResult,
              feedbackTopic: action.payload.feedbackTopic,
              addressAutocompleteLocator:
                action.payload.addressAutocompleteLocator,
              countryCode: getCountryCodeFromAddress(
                siretResult.businessAddress,
              ),
            });
          }),
          catchEpicError((error) =>
            siretSlice.actions.siretInfoFailed(
              error.message as GetSiretInfoError,
            ),
          ),
        ),
    ),
  );
};

export const siretEpics = [
  triggerSiretFetchEpic,
  getSiretEpic,
  toggleShouldThrowErrorOnAlreadySaved,
];
