import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import {
  RadioButtons,
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import { useFormContext } from "react-hook-form";
import { useDispatch, useSelector } from "react-redux";
import type { ConventionDto, InternshipKind } from "shared";
import type {
  EmailValidationErrorsState,
  SetEmailValidationErrorsState,
} from "src/app/components/forms/convention/ConventionForm";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import { useConventionTexts } from "src/app/contents/forms/convention/textSetup";
import { useTutorIsEstablishmentRepresentative } from "src/app/hooks/convention.hooks";
import { getFormContents } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { conventionSlice } from "src/core-logic/domain/convention/convention.slice";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import { EstablishementTutorFields } from "./EstablishementTutorFields";
import { EstablishmentBusinessFields } from "./EstablishmentBusinessFields";
import { EstablishmentRepresentativeFields } from "./EstablishmentRepresentativeFields";

export const tutorSelectOptions = (
  internshipKind: InternshipKind,
): RadioButtonsProps["options"] => [
  {
    label: "Le représentant de l'entreprise sera également le tuteur",
    hintText: `La même personne signera la convention, accompagnera ${
      internshipKind === "immersion" ? "l'immersion" : "le stage"
    } au sein de l'entreprise et remplira le bilan.`,
    nativeInputProps: {
      value: 1,
    },
  },
  {
    label: "Le tuteur est différent du représentant de l'entreprise",
    hintText: `Le tuteur accompagnera ${
      internshipKind === "immersion" ? "l'immersion" : "le stage"
    } dans l'entreprise et remplira le bilan. Il ne signera pas la convention, mais la recevra tout de même par email.`,
    nativeInputProps: {
      value: 0,
    },
  },
];

export const EstablishmentFormSection = ({
  setEmailValidationErrors,
  emailValidationErrors,
  isConventionTemplate,
}: {
  setEmailValidationErrors: SetEmailValidationErrorsState;
  emailValidationErrors: EmailValidationErrorsState;
  isConventionTemplate: boolean;
}): JSX.Element => {
  useTutorIsEstablishmentRepresentative();

  const dispatch = useDispatch();
  const isTutorEstablishmentRepresentative = useAppSelector(
    conventionSelectors.isTutorEstablishmentRepresentative,
  );
  const { getValues, setValue } = useFormContext<ConventionDto>();
  const t = useConventionTexts(getValues().internshipKind);

  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: getValues("internshipKind"),
      isConventionTemplate,
    }),
  );
  const formContents = getFormFields();

  const isFetchingSiret = useSelector(siretSelectors.isFetching);

  const shouldResetTutorFields = () => {
    const representative = getValues("signatories.establishmentRepresentative");
    const tutor = getValues("establishmentTutor");
    return (
      representative.firstName === tutor.firstName &&
      tutor.lastName === representative.lastName &&
      tutor.phone === representative.phone &&
      tutor.email === representative.email
    );
  };

  const resetTutorFields = () => {
    setValue("establishmentTutor.firstName", "");
    setValue("establishmentTutor.lastName", "");
    setValue("establishmentTutor.email", "");
    setValue("establishmentTutor.phone", "");
  };

  return (
    <>
      <Alert
        severity="info"
        small
        className={fr.cx("fr-my-2w")}
        description={t.establishmentSection.subtitle}
      />

      <EstablishmentBusinessFields
        isConventionTemplate={isConventionTemplate}
      />
      <EstablishmentRepresentativeFields
        emailValidationErrors={emailValidationErrors}
        setEmailValidationErrors={setEmailValidationErrors}
        isConventionTemplate={isConventionTemplate}
      />
      <RadioButtons
        id={formContents.isEstablishmentTutorIsEstablishmentRepresentative.id}
        legend={
          formContents.isEstablishmentTutorIsEstablishmentRepresentative.label
        }
        options={tutorSelectOptions(getValues("internshipKind")).map(
          (option) => ({
            ...option,
            nativeInputProps: {
              checked:
                Boolean(option.nativeInputProps.value) ===
                isTutorEstablishmentRepresentative,
              onChange: () => {
                const isTutorRepresentative =
                  option.nativeInputProps.value === 1;
                dispatch(
                  conventionSlice.actions.isTutorEstablishmentRepresentativeChanged(
                    isTutorRepresentative,
                  ),
                );
                if (isTutorRepresentative)
                  setEmailValidationErrors(
                    ({ "Tuteur de l'entreprise": _, ...rest }) => rest,
                  );
                if (shouldResetTutorFields()) {
                  resetTutorFields();
                }
              },
            },
          }),
        )}
        disabled={isFetchingSiret}
      />
      <EstablishementTutorFields
        emailValidationErrors={emailValidationErrors}
        setEmailValidationErrors={setEmailValidationErrors}
        isTutorEstablishmentRepresentative={isTutorEstablishmentRepresentative}
        isConventionTemplate={isConventionTemplate}
      />
    </>
  );
};
