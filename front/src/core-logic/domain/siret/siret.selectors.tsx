import { createSelector } from "@reduxjs/toolkit";
import type { ReactNode } from "react";
import { frontRoutes } from "shared";
import type { SiretSliceError } from "src/core-logic/domain/siret/siret.slice";
import { createRootSelector } from "src/core-logic/storeConfig/store";

const siretState = createRootSelector(({ siret }) => siret);

const currentSiret = createSelector(
  siretState,
  ({ currentSiret }) => currentSiret,
);

const establishmentInfos = createSelector(
  siretState,
  ({ establishment }) => establishment,
);

const countryCode = createSelector(
  siretState,
  ({ countryCode }) => countryCode,
);

const isFetching = createSelector(siretState, ({ isSearching }) => isSearching);

const shouldThrowErrorOnAlreadySaved = createSelector(
  siretState,
  ({ shouldThrowErrorOnAlreadySaved }) => shouldThrowErrorOnAlreadySaved,
);

const siretRawError = createSelector(siretState, ({ error }) => error);

const siretErrorToDisplay = createSelector(
  siretRawError,
  (error): ReactNode | null => {
    if (!error) return null;
    return errorTranslations[error] ?? error;
  },
);

const errorTranslations: Partial<Record<SiretSliceError, ReactNode>> = {
  "Missing establishment on SIRENE API.":
    "Nous n'avons pas trouvé d'établissement correspondant à votre SIRET.",
  "SIRET must be 14 digits": "Le SIRET doit être composé de 14 chiffres",
  "Already exists": (
    <span>
      Cet établissement est déjà référencé. Veuillez faire une{" "}
      <a
        href={frontRoutes.myAccountEstablishmentRegistration().href}
        rel="noreferrer"
      >
        demande de rattachement
      </a>{" "}
      afin d'obtenir les droits de gestion nécessaires.
    </span>
  ),
  "Too many requests on SIRENE API.":
    "Le service de vérification du SIRET a reçu trop d'appels.",
};

const isSiretAlreadySaved = createSelector(
  siretState,
  ({ establishment }) => establishment?.isAlreadySaved,
);

export const siretSelectors = {
  isSiretAlreadySaved,
  siretErrorToDisplay,
  siretRawError,
  currentSiret,
  establishmentInfos,
  isFetching,
  shouldThrowErrorOnAlreadySaved,
  countryCode,
};
