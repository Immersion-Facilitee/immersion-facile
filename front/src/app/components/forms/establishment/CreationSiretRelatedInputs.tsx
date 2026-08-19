import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { pick } from "ramda";
import { useEffect } from "react";
import { Loader } from "react-design-system";
import { useFormContext } from "react-hook-form";
import {
  defaultMaxContactsPerMonth,
  type FormEstablishmentDto,
  type NumberEmployeesRange,
} from "shared";
import { formEstablishmentFieldsLabels } from "src/app/contents/forms/establishment/formEstablishment";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useSiretFetcher } from "src/app/hooks/siret.hooks";
import { v4 as uuidV4 } from "uuid";

export const CreationSiretRelatedInputs = () => {
  const {
    establishmentInfos,
    isFetchingSiret,
    siretErrorToDisplay,
    updateSiret,
  } = useSiretFetcher({
    shouldThrowErrorOnAlreadySaved: true,
    addressAutocompleteLocator: "create-establishment-address",
  });
  const {
    setValue,
    register,
    formState: { touchedFields, errors },
  } = useFormContext<FormEstablishmentDto>();
  const { getFormFields } = getFormContents(
    formEstablishmentFieldsLabels("create"),
  );
  const formContents = getFormFields();
  const getFieldError = makeFieldError(
    useFormContext<FormEstablishmentDto>().formState,
  );

  useEffect(() => {
    if (isFetchingSiret) return;
    setValue(
      "businessName",
      establishmentInfos ? establishmentInfos.businessName : "",
    );
    setValue(
      "businessAddresses.0",
      establishmentInfos
        ? {
            rawAddress: establishmentInfos.businessAddress,
            id: uuidV4(),
          }
        : {
            id: "",
            rawAddress: "",
          },
    );
    setValue("naf", establishmentInfos ? establishmentInfos.nafDto : undefined);
    setValue(
      "maxContactsPerMonth",
      establishmentInfos
        ? maxContactPerWeekByNumberEmployees[
            establishmentInfos.numberEmployeesRange
          ]
        : defaultMaxContactsPerMonth,
    );
  }, [establishmentInfos]);
  const getSiretError = () => {
    if (errors.siret) {
      return errors.siret.message;
    }
    if (siretErrorToDisplay && touchedFields.siret) {
      return siretErrorToDisplay;
    }
    return "";
  };
  const siretError = getSiretError();
  return (
    <>
      {isFetchingSiret && <Loader />}
      <Input
        label={formContents.siret.label}
        hintText={formContents.siret.hintText}
        nativeInputProps={{
          ...pick(["id", "name", "required"], formContents.siret),
          ...register("siret"),
          onChange: (event) => {
            updateSiret(event.target.value);
            setValue("siret", event.target.value);
          },
        }}
        state={siretError ? "error" : "default"}
        stateRelatedMessage={siretError}
      />
      <p>
        <a
          className={fr.cx("fr-link")}
          href={"https://annuaire-entreprises.data.gouv.fr"}
          target="_blank"
          rel="noreferrer"
        >
          Retrouver votre SIRET sur l’Annuaire des Entreprises
        </a>
      </p>

      <Input
        label={formContents.businessName.label}
        hintText={formContents.businessName.hintText}
        disabled
        nativeInputProps={{
          ...pick(["id", "name", "required"], formContents.businessName),
          ...register("businessName"),
        }}
      />
      <Input
        label={formContents.businessNameCustomized.label}
        hintText={formContents.businessNameCustomized.hintText}
        disabled={isFetchingSiret}
        nativeInputProps={{
          ...pick(
            ["id", "name", "required"],
            formContents.businessNameCustomized,
          ),
          ...register("businessNameCustomized", {
            setValueAs: (value) => (value ? value : undefined),
          }),
        }}
        {...getFieldError("businessNameCustomized")}
      />
    </>
  );
};

const maxContactPerWeekByNumberEmployees: Record<NumberEmployeesRange, number> =
  {
    "": defaultMaxContactsPerMonth,
    "0": 2,
    "0-0": 2,
    "1-2": 2,
    "3-5": 2,
    "6-9": 2,
    "10-19": 6,
    "20-49": 6,
    "50-99": 8,
    "100-199": 8,
    "200-249": 8,
    "250-499": 8,
    "500-999": 8,
    "1000-1999": 8,
    "2000-4999": 8,
    "5000-9999": 8,
    "+10000": 8,
  };
