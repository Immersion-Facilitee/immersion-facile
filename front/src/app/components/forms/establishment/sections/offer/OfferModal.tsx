import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { useState } from "react";
import { equals } from "react-design-system";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  establishmentFormOfferSchema,
  type FormEstablishmentDto,
  replaceAtIndex,
} from "shared";
import {
  type CurrentOffer,
  emptyOffer,
  OfferFields,
  offerFieldsErrorsFromIssues,
} from "src/app/components/forms/establishment/sections/offer/OfferFields";
import type { Mode } from "src/app/routes/routes.hooks";
import { appellationSlice } from "src/core-logic/domain/appellation/appellation.slice";
import type { $ZodIssue } from "zod/v4/core";

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
  const [disclosureCount, setDisclosureCount] = useState(0);
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
      setDisclosureCount((count) => count + 1);
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
      <OfferFields
        key={`${selectedOfferIndex ?? "new"}-${disclosureCount}`}
        mode={mode}
        offer={currentOffer}
        onOfferChange={(offer) => {
          setErrors([]);
          setCurrentOffer(offer);
        }}
        {...offerFieldsErrorsFromIssues(errors)}
      />
    </offerModal.Component>
  );
};
