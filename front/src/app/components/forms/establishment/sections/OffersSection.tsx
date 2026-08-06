import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { values } from "ramda";
import { useState } from "react";
import { ErrorNotifications, HeadingSection } from "react-design-system";
import { createPortal } from "react-dom";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  addressDtoToString,
  domElementIds,
  type FormEstablishmentDto,
  removeAtIndex,
} from "shared";
import type {
  OnStepChange,
  Step,
} from "src/app/components/forms/establishment/EstablishmentForm";
import { MultipleAddressInput } from "src/app/components/forms/establishment/MultipleAddressInput";
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
import { v4 as uuidV4 } from "uuid";

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
    setValue,
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
      {formValues.offers.filter(
        (offer) => offer.remoteWorkMode !== "FULL_REMOTE",
      ).length > 0 && (
        <HeadingSection
          title={formContents.businessAddresses.label}
          description="Par défaut, vous apparaîtrez dans les résultats de recherche liés à l’adresse de votre établissement. Vous pouvez ajouter d’autres adresses si vous proposez des immersions ailleurs. Par exemple : votre société est située à Dijon (adresse liée à votre SIRET) mais vous proposez une immersion dans votre antenne de Nantes."
        >
          <MultipleAddressInput
            name="businessAddress"
            currentAddresses={formValues.businessAddresses}
            onAddressAdded={(address, index) => {
              const currentAddresses = formValues.businessAddresses;
              currentAddresses[index] = {
                id: uuidV4(),
                rawAddress: addressDtoToString(address),
              };
              setValue("businessAddresses", currentAddresses);
            }}
            onAddressDeleted={(index) => {
              const addresses = formValues.businessAddresses;
              const newAddresses =
                index === 0 && addresses.length === 1
                  ? [
                      {
                        id: "",
                        rawAddress: "",
                      },
                    ]
                  : removeAtIndex(addresses, index);
              setValue("businessAddresses", newAddresses);
            }}
            id={domElementIds.formEstablishment[mode].businessAddresses}
          />
        </HeadingSection>
      )}
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
                  onStepChange(1, []);
                },
              },
              {
                children: "Étape suivante",
                onClick: () => {
                  onStepChange(3, ["offers", "businessAddresses"]);
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
