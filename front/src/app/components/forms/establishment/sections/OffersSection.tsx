import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { values } from "ramda";
import { type ReactNode, useState } from "react";
import { ErrorNotifications, HeadingSection } from "react-design-system";
import { createPortal } from "react-dom";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AppellationCode,
  domElementIds,
  type EstablishmentFormOffer,
  type FormEstablishmentDto,
} from "shared";
import type {
  OnStepChange,
  Step,
} from "src/app/components/forms/establishment/EstablishmentForm";
import { BusinessAddressesSection } from "src/app/components/forms/establishment/sections/BusinessAddressesSection";
import { OfferCard } from "src/app/components/forms/establishment/sections/offer/OfferCard";
import {
  emptyOffer,
  OfferFields,
} from "src/app/components/forms/establishment/sections/offer/OfferFields";
import {
  OfferModal,
  offerModal,
} from "src/app/components/forms/establishment/sections/offer/OfferModal";
import { formEstablishmentFieldsLabels } from "src/app/contents/forms/establishment/formEstablishment";
import {
  displayReadableError,
  getFormContents,
  toErrorsWithLabels,
} from "src/app/hooks/formContents.hooks";
import type { Mode } from "src/app/routes/routes.hooks";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";

const deleteOfferModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.formEstablishment.edit.deleteOfferModal,
});

export const OffersSection = ({
  mode,
  onStepChange,
  currentStep,
  onOfferEditionRequested,
  onOfferDeletionRequested,
}: {
  mode: Mode;
  onStepChange: OnStepChange;
  currentStep: Step;
  onOfferEditionRequested?: (appellationCode?: AppellationCode) => void;
  onOfferDeletionRequested?: (appellationCode: AppellationCode) => void;
}): ReactNode => {
  const isStepMode = currentStep !== null;
  const methods = useFormContext<FormEstablishmentDto>();
  const {
    watch,
    formState: { errors },
  } = methods;
  const formValues = watch();
  const { getFormErrors, getFormFields } = getFormContents(
    formEstablishmentFieldsLabels(mode),
  );
  const dispatch = useDispatch();
  const formContents = getFormFields();
  const formErrors = getFormErrors();
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<number | null>(
    null,
  );
  const [offerToDelete, setOfferToDelete] =
    useState<EstablishmentFormOffer | null>(null);

  return (
    <>
      {isStepMode ? (
        <FirstOfferSection mode={mode} />
      ) : (
        <HeadingSection
          title={formContents.offers.label}
          description=" Chaque métier correspond à une offre qui apparaitra dans la recherche.
          Votre entreprise peut donc apparaître dans différentes recherches."
          className={fr.cx("fr-mt-0", "fr-mb-4w")}
        >
          <Button
            className={fr.cx("fr-my-4v")}
            type="button"
            iconId="fr-icon-add-line"
            title="Ajouter un métier"
            id={domElementIds.formEstablishment[mode].addOfferButton}
            priority="secondary"
            onClick={() => {
              if (onOfferEditionRequested) return onOfferEditionRequested();
              setSelectedOfferIndex(null);
              offerModal.open();
            }}
          >
            Ajouter un métier
          </Button>
          {formValues.offers.length > 0 && (
            <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
              {formValues.offers.map((offer, index) => (
                <OfferCard
                  key={`${offer.appellationCode}-${index}`}
                  index={index}
                  mode={mode}
                  onEditOfferClick={() => {
                    if (onOfferEditionRequested)
                      return onOfferEditionRequested(offer.appellationCode);
                    setSelectedOfferIndex(index);
                    dispatch(
                      appellationSlice.actions.selectSuggestionRequested({
                        item: {
                          appellationCode: offer.appellationCode,
                          appellationLabel: offer.appellationLabel,
                          romeCode: offer.romeCode,
                          romeLabel: offer.romeLabel,
                        },
                        locator: "form-establishment-offer-modal",
                      }),
                    );
                    offerModal.open();
                  }}
                  onDeleteOfferClick={
                    onOfferDeletionRequested &&
                    (() => {
                      setOfferToDelete(offer);
                      deleteOfferModal.open();
                    })
                  }
                />
              ))}
            </div>
          )}
        </HeadingSection>
      )}
      {isStepMode && <BusinessAddressesSection mode={mode} />}
      {isStepMode && (
        <>
          <ErrorNotifications
            errorsWithLabels={toErrorsWithLabels({
              labels: formErrors,
              errors: displayReadableError(errors),
            })}
            visible={values(errors).length > 0}
          />

          <ButtonsGroup
            inlineLayoutWhen="always"
            alignment="left"
            buttonsEquisized
            className={fr.cx("fr-mt-4w")}
            buttons={[
              {
                children: "Étape précédente",
                iconId: "fr-icon-arrow-left-line",
                priority: "secondary",
                id: domElementIds.formEstablishment[
                  mode
                ].previousButtonFromStepAndMode({
                  currentStep,
                  mode,
                }),
                type: "button",
                onClick: () => {
                  onStepChange(2, []);
                },
              },
              {
                children: "Étape suivante",
                onClick: () => {
                  onStepChange(4, ["offers", "businessAddresses"]);
                },
                type: "button",
                iconId: "fr-icon-arrow-right-line",
                iconPosition: "right",
                id: domElementIds.formEstablishment[
                  mode
                ].nextButtonFromStepAndMode({
                  currentStep,
                  mode,
                }),
              },
            ]}
          />
        </>
      )}
      {onOfferDeletionRequested &&
        createPortal(
          <deleteOfferModal.Component
            title="Supprimer ce métier ?"
            buttons={[
              { doClosesModal: true, children: "Annuler" },
              {
                doClosesModal: true,
                children: "Supprimer",
                id: domElementIds.formEstablishment.edit
                  .deleteOfferConfirmButton,
                onClick: () => {
                  if (offerToDelete)
                    onOfferDeletionRequested(offerToDelete.appellationCode);
                },
              },
            ]}
          >
            Le métier « {offerToDelete?.appellationLabel} » sera supprimé de
            votre fiche entreprise et n'apparaîtra plus dans la recherche.
          </deleteOfferModal.Component>,
          document.body,
        )}
      {!isStepMode &&
        !onOfferEditionRequested &&
        createPortal(
          <OfferModal selectedOfferIndex={selectedOfferIndex} mode={mode} />,
          document.body,
        )}
    </>
  );
};

const defaultFirstOffer: EstablishmentFormOffer = {
  ...emptyOffer,
  remoteWorkMode: "ON_SITE",
};

const FirstOfferSection = ({ mode }: { mode: Mode }): ReactNode => {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FormEstablishmentDto>();
  const firstOffer = watch("offers")[0] ?? defaultFirstOffer;
  const firstOfferErrors = errors.offers?.[0];

  return (
    <>
      <p>
        Elle apparaîtra dans la recherche. Vous pourrez ajouter d'autres offres
        une fois l'inscription terminée.
      </p>
      <OfferFields
        mode={mode}
        offer={firstOffer}
        onOfferChange={(offer) =>
          setValue("offers", [offer], { shouldValidate: !!errors.offers })
        }
        hasAppellationError={
          !!errors.offers?.message ||
          !!firstOfferErrors?.appellationCode ||
          !!firstOfferErrors?.appellationLabel ||
          !!firstOfferErrors?.romeCode ||
          !!firstOfferErrors?.romeLabel
        }
        hasRemoteWorkModeError={!!firstOfferErrors?.remoteWorkMode}
      />
    </>
  );
};
