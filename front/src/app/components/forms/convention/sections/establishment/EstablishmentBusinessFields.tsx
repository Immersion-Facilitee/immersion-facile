import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { ConventionReadDto } from "shared";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import {
  useSiretFetcher,
  useSiretRelatedField,
} from "src/app/hooks/siret.hooks";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";

export const EstablishmentBusinessFields = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}): JSX.Element => {
  const { getValues, register, control, setValue, formState } =
    useFormContext<ConventionReadDto>();
  const values = getValues();
  const siretValueOnForm = useWatch({ control, name: "siret" });
  const initialSiret = useRef(values.siret);
  const initialBusinessNameCustomized = useRef(values.businessNameCustomized);
  const currentSiret = useAppSelector(siretSelectors.currentSiret);
  const isSiretUpdated =
    (currentSiret ?? siretValueOnForm) !== initialSiret.current;
  const shouldUpdateImmersionAddress =
    (values.status === "READY_TO_SIGN" && values.immersionAddress === "") ||
    isSiretUpdated;
  const shouldPrefillBusinessNameCustomizedFromSiret =
    isSiretUpdated || !initialBusinessNameCustomized.current;
  const {
    updateSiret,
    siretErrorToDisplay,
    establishmentInfos,
    isFetchingSiret,
  } = useSiretFetcher({
    shouldThrowErrorOnAlreadySaved: false,
    addressAutocompleteLocator: "convention-immersion-address",
  });
  const convention = useAppSelector(conventionSelectors.convention);

  useSiretRelatedField("businessName", {
    disabled: false, // the input is always disabled, so we can safely update businessName from siret
  });
  useSiretRelatedField("businessNameCustomized", {
    disabled: !shouldPrefillBusinessNameCustomizedFromSiret,
  });
  useSiretRelatedField("businessAddress", {
    fieldToUpdate: "immersionAddress",
    disabled: !shouldUpdateImmersionAddress,
  });

  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: values.internshipKind,
      isConventionTemplate,
    }),
  );
  const formContents = getFormFields();
  const getFieldError = makeFieldError(formState);
  return (
    <>
      <Input
        label={formContents.siret.label}
        hintText={formContents.siret.hintText}
        nativeInputProps={{
          ...formContents.siret,
          onChange: (event) => {
            setValue("siret", event.target.value);
            updateSiret(event.target.value);
          },
          value: currentSiret || siretValueOnForm,
        }}
        disabled={isFetchingSiret}
        state={siretErrorToDisplay ? "error" : undefined}
        stateRelatedMessage={siretErrorToDisplay}
        className={fr.cx("fr-mb-1w")}
      />
      <p className={fr.cx("fr-mb-1w")}>
        <a
          href="https://annuaire-entreprises.data.gouv.fr/"
          target="_blank"
          rel="noreferrer"
          className={fr.cx("fr-link")}
        >
          <i className={fr.cx("fr-icon-information-fill", "fr-icon--sm")} />
          Retrouver votre siret sur l'Annuaire des Entreprises
        </a>
      </p>
      <p className={fr.cx("fr-mt-1w", "fr-mb-1w")}>
        <a
          href="https://tally.so/r/w2X7xV"
          target="_blank"
          rel="noreferrer"
          className={fr.cx("fr-link")}
        >
          <i className={fr.cx("fr-icon-information-fill", "fr-icon--sm")} />
          Mon entreprise n'a pas de SIRET
        </a>
      </p>
      {values.agencyKind === "fonction-publique" && (
        <p className={fr.cx("fr-mt-1w", "fr-mb-1w")}>
          <a
            href="https://pages.immersion-facile.beta.gouv.fr/ressources-candidats/pmsmp-agent-public-cdg60"
            target="_blank"
            rel="noreferrer"
            className={fr.cx("fr-link")}
          >
            <i className={fr.cx("fr-icon-information-fill", "fr-icon--sm")} />
            Pas à pas
          </a>
        </p>
      )}
      <Input
        label={formContents.businessName.label}
        hintText={formContents.businessName.hintText}
        nativeInputProps={{
          ...formContents.businessName,
          ...register("businessName"),
          value:
            establishmentInfos?.businessName || convention?.businessName || "",
        }}
        disabled={true}
        className={fr.cx("fr-mt-3w")}
      />
      <Input
        label={formContents.businessNameCustomized.label}
        hintText={formContents.businessNameCustomized.hintText}
        nativeInputProps={{
          ...formContents.businessNameCustomized,
          ...register("businessNameCustomized", {
            setValueAs: (value) => (value ? value : undefined),
          }),
        }}
        {...getFieldError("businessNameCustomized")}
        className={fr.cx("fr-mt-2w")}
      />
    </>
  );
};
