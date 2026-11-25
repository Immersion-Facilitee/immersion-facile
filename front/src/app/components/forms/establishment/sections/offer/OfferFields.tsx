import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { type ReactNode, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type EstablishmentFormOffer,
  type OmitFromExistingKeys,
  type RemoteWorkMode,
  remoteWorkModeLabels,
  remoteWorkModes,
} from "shared";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import type { Mode } from "src/app/routes/routes.hooks";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";
import type { $ZodIssue } from "zod/v4/core";

export type CurrentOffer = OmitFromExistingKeys<
  EstablishmentFormOffer,
  "remoteWorkMode"
> & {
  remoteWorkMode?: RemoteWorkMode;
};

export const emptyOffer: CurrentOffer = {
  appellationCode: "",
  appellationLabel: "",
  romeCode: "",
  romeLabel: "",
  remoteWorkMode: undefined,
};

type OfferFieldsErrors = {
  hasAppellationError: boolean;
  hasRemoteWorkModeError: boolean;
};

type OfferFieldsProps<T extends CurrentOffer> = OfferFieldsErrors & {
  mode: Mode;
  offer: T;
  onOfferChange: (offer: T) => void;
};

const appellationFields: (keyof EstablishmentFormOffer)[] = [
  "appellationCode",
  "appellationLabel",
  "romeCode",
  "romeLabel",
];

export const offerFieldsErrorsFromIssues = (
  issues: $ZodIssue[],
): OfferFieldsErrors => ({
  hasAppellationError: issues.some((issue) =>
    appellationFields.some((field) => issue.path.join(".") === field),
  ),
  hasRemoteWorkModeError: issues.some(
    (issue) => issue.path.join(".") === "remoteWorkMode",
  ),
});

export const OfferFields = <T extends CurrentOffer>({
  mode,
  offer,
  onOfferChange,
  hasAppellationError,
  hasRemoteWorkModeError,
}: OfferFieldsProps<T>): ReactNode => {
  const dispatch = useDispatch();
  const initialOffer = useRef(offer).current;

  useEffect(() => {
    if (initialOffer.appellationCode)
      dispatch(
        appellationSlice.actions.selectSuggestionRequested({
          item: {
            appellationCode: initialOffer.appellationCode,
            appellationLabel: initialOffer.appellationLabel,
            romeCode: initialOffer.romeCode,
            romeLabel: initialOffer.romeLabel,
          },
          locator: "form-establishment-offer-modal",
        }),
      );
    return () => {
      dispatch(
        appellationSlice.actions.clearLocatorDataRequested({
          locator: "form-establishment-offer-modal",
        }),
      );
    };
  }, [dispatch, initialOffer]);

  return (
    <>
      <AppellationAutocomplete
        label="Métier proposé"
        locator="form-establishment-offer-modal"
        selectProps={{
          inputId: domElementIds.formEstablishment[mode].appellations,
        }}
        initialInputValue={initialOffer.appellationLabel || undefined}
        onAppellationSelected={(appellation) =>
          onOfferChange({
            ...offer,
            appellationCode: appellation.appellationCode,
            appellationLabel: appellation.appellationLabel,
            romeCode: appellation.romeCode,
            romeLabel: appellation.romeLabel,
          })
        }
        onAppellationClear={() =>
          onOfferChange({
            ...offer,
            appellationCode: "",
            appellationLabel: "",
            romeCode: "",
            romeLabel: "",
          })
        }
        stateRelatedMessage={
          hasAppellationError ? (
            "Le métier sélectionné semble invalide"
          ) : (
            <>
              Les métiers sont basés sur la&nbsp;
              <a
                id={domElementIds.formEstablishment[mode].appellationsListLink}
                href="https://candidat.francetravail.fr/metierscope/metiers"
                target="_blank"
                rel="noreferrer"
              >
                liste officielle de France Travail
              </a>
            </>
          )
        }
        state={hasAppellationError ? "error" : "info"}
      />
      <RadioButtons
        legend="Proposez-vous du télétravail sur ce métier ?"
        id={domElementIds.formEstablishment[mode].remoteWorkMode}
        options={remoteWorkModes.map((remoteWorkMode) => ({
          label: remoteWorkModeLabels[remoteWorkMode].answerLabel,
          nativeInputProps: {
            value: remoteWorkMode,
            checked: offer.remoteWorkMode === remoteWorkMode,
            onChange: () => onOfferChange({ ...offer, remoteWorkMode }),
          },
        }))}
        state={hasRemoteWorkModeError ? "error" : "default"}
        stateRelatedMessage={
          hasRemoteWorkModeError
            ? "Le mode de travail sélectionné semble invalide"
            : undefined
        }
      />
    </>
  );
};
