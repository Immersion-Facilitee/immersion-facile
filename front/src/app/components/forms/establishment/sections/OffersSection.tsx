import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { values } from "ramda";
import { useState } from "react";
import { ErrorNotifications, HeadingSection } from "react-design-system";
import { createPortal } from "react-dom";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import { domElementIds, type FormEstablishmentDto } from "shared";
import type {
  OnStepChange,
  Step,
} from "src/app/components/forms/establishment/EstablishmentForm";
import { BusinessAddressesSection } from "src/app/components/forms/establishment/sections/BusinessAddressesSection";
import { OfferCard } from "src/app/components/forms/establishment/sections/offer/OfferCard";
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

export const OffersSection = ({
  mode,
  onStepChange,
  currentStep,
}: {
  mode: Mode;
  onStepChange: OnStepChange;
  currentStep: Step;
}) => {
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

  return (
    <>
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
            setSelectedOfferIndex(null);
            appellationSlice.actions.clearLocatorDataRequested({
              locator: "form-establishment-offer-modal",
            });
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
              />
            ))}
          </div>
        )}
      </HeadingSection>
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
      {createPortal(
        <OfferModal selectedOfferIndex={selectedOfferIndex} mode={mode} />,
        document.body,
      )}
    </>
  );
};
