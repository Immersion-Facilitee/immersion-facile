import { HeadingSection } from "react-design-system";
import { useFormContext } from "react-hook-form";
import {
  addressDtoToString,
  domElementIds,
  type FormEstablishmentDto,
  removeAtIndex,
} from "shared";
import { MultipleAddressInput } from "src/app/components/forms/establishment/MultipleAddressInput";
import { formEstablishmentFieldsLabels } from "src/app/contents/forms/establishment/formEstablishment";
import { getFormContents } from "src/app/hooks/formContents.hooks";
import type { Mode } from "src/app/routes/routes.hooks";
import { v4 as uuidV4 } from "uuid";

export const BusinessAddressesSection = ({ mode }: { mode: Mode }) => {
  const { setValue, watch } = useFormContext<FormEstablishmentDto>();
  const formValues = watch();
  const { getFormFields } = getFormContents(
    formEstablishmentFieldsLabels(mode),
  );
  const formContents = getFormFields();

  if (
    formValues.offers.every((offer) => offer.remoteWorkMode === "FULL_REMOTE")
  )
    return null;

  return (
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
  );
};
