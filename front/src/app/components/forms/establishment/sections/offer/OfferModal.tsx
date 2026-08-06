import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import { Fragment, useState } from "react";
import { equals } from "react-design-system";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  type EstablishmentFormOffer,
  establishmentFormOfferSchema,
  type FormEstablishmentDto,
  type OmitFromExistingKeys,
  type RemoteWorkMode,
  remoteWorkModeLabels,
  remoteWorkModes,
  replaceAtIndex,
} from "shared";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";
import type { Mode } from "src/app/routes/routes.hooks";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";
import { v4 as uuidV4 } from "uuid";
import type { $ZodIssue } from "zod/v4/core";

const getIssueForField = <T,>(issues: $ZodIssue[], field: keyof T) => {
  return issues.find((issue) => issue.path.join(".") === field);
};

const getIssueForAppellationAndRome = (issues: $ZodIssue[]) =>
  getIssueForField<EstablishmentFormOffer>(issues, "appellationCode") ||
  getIssueForField<EstablishmentFormOffer>(issues, "appellationLabel") ||
  getIssueForField<EstablishmentFormOffer>(issues, "romeCode") ||
  getIssueForField<EstablishmentFormOffer>(issues, "romeLabel");

type CurrentOffer = OmitFromExistingKeys<
  EstablishmentFormOffer,
  "remoteWorkMode"
> & {
  remoteWorkMode?: RemoteWorkMode;
};

const emptyOffer: CurrentOffer = {
  appellationCode: "",
  appellationLabel: "",
  romeCode: "",
  romeLabel: "",
  remoteWorkMode: undefined,
};

export const offerModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.formEstablishment.offerModal,
});

export const OfferModal = ({
  selectedOfferIndex,
  mode,
}: {
  selectedOfferIndex: number | null;
  mode: Mode;
}) => {
  const { watch, setValue } = useFormContext<FormEstablishmentDto>();
  const formValues = watch();
  const [currentOffer, setCurrentOffer] = useState<CurrentOffer>(
    selectedOfferIndex === null
      ? emptyOffer
      : formValues.offers[selectedOfferIndex],
  );
  const [errors, setErrors] = useState<$ZodIssue[]>([]);
  const dispatch = useDispatch();

  if (selectedOfferIndex !== null && equals(currentOffer, emptyOffer)) {
    setCurrentOffer(formValues.offers[selectedOfferIndex]);
  }

  useIsModalOpen(offerModal, {
    onConceal: () => {
      dispatch(
        appellationSlice.actions.clearLocatorDataRequested({
          locator: "form-establishment-offer-modal",
        }),
      );
    },
    onDisclose: () => {
      setCurrentOffer(emptyOffer);
      setErrors([]);
    },
  });

  return (
    <offerModal.Component
      title={
        selectedOfferIndex !== null ? "Modifier un métier" : "Ajouter un métier"
      }
      buttons={[
        {
          doClosesModal: true,
          children: "Annuler",
        },
        {
          doClosesModal: false,
          children:
            selectedOfferIndex !== null
              ? "Modifier ce métier"
              : "Ajouter ce métier",
          id: domElementIds.formEstablishment.offerModalSubmitButton,
          onClick: async () => {
            const { offers } = formValues;
            const validCurrentOfferResult =
              establishmentFormOfferSchema.safeParse(currentOffer);
            if (!validCurrentOfferResult.success) {
              setErrors(validCurrentOfferResult.error.issues);
              return;
            }
            const validCurrentOffer = validCurrentOfferResult.data;
            const newOffers =
              selectedOfferIndex === null
                ? [...offers, validCurrentOffer]
                : replaceAtIndex(offers, selectedOfferIndex, validCurrentOffer);
            setValue("offers", newOffers);
            offerModal.close();
          },
        },
      ]}
    >
      <Fragment key={selectedOfferIndex?.toString() ?? uuidV4()}>
        <AppellationAutocomplete
          label={"Rechercher un métier"}
          locator={"form-establishment-offer-modal"}
          selectProps={{
            inputId: domElementIds.formEstablishment[mode].appellations,
          }}
          initialInputValue={
            selectedOfferIndex
              ? formValues.offers[selectedOfferIndex].appellationLabel
              : undefined
          }
          onAppellationSelected={(appellation) => {
            setCurrentOffer({
              ...currentOffer,
              appellationCode: appellation.appellationCode,
              appellationLabel: appellation.appellationLabel,
              romeCode: appellation.romeCode,
              romeLabel: appellation.romeLabel,
            });
            setErrors([]);
          }}
          onAppellationClear={() => {
            setCurrentOffer({
              ...emptyOffer,
              remoteWorkMode: currentOffer.remoteWorkMode,
            });
            setErrors([]);
          }}
          stateRelatedMessage={
            getIssueForAppellationAndRome(errors) ? (
              "Le métier sélectionné semble invalide"
            ) : (
              <>
                Les métiers sont basés sur la&nbsp;
                <a
                  href="https://candidat.francetravail.fr/metierscope/metiers"
                  target="_blank"
                  rel="noreferrer"
                >
                  liste officielle de France Travail
                </a>
              </>
            )
          }
          state={getIssueForAppellationAndRome(errors) ? "error" : "info"}
        />
        <RadioButtons
          legend={"Proposez-vous du télétravail sur ce métier ?"}
          id={domElementIds.formEstablishment[mode].remoteWorkMode}
          options={remoteWorkModes.map((remoteWorkMode) => ({
            label: remoteWorkModeLabels[remoteWorkMode].answerLabel,
            nativeInputProps: {
              value: remoteWorkMode,

              checked: currentOffer.remoteWorkMode === remoteWorkMode,
              onChange: () => {
                setErrors([]);
                setCurrentOffer({
                  ...currentOffer,
                  remoteWorkMode,
                });
              },
            },
          }))}
          state={
            getIssueForField<EstablishmentFormOffer>(errors, "remoteWorkMode")
              ? "error"
              : "default"
          }
          stateRelatedMessage={
            getIssueForField<EstablishmentFormOffer>(errors, "remoteWorkMode")
              ? "Le mode de travail sélectionné semble invalide"
              : undefined
          }
        />
      </Fragment>
    </offerModal.Component>
  );
};
