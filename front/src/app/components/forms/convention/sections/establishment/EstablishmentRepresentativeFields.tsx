import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";

import { useFormContext } from "react-hook-form";
import {
  type ConventionReadDto,
  defaultCountryCode,
  toLowerCaseWithoutDiacritics,
} from "shared";
import { ConventionEmailWarning } from "src/app/components/forms/convention/ConventionEmailWarning";
import type {
  EmailValidationErrorsState,
  SetEmailValidationErrorsState,
} from "src/app/components/forms/convention/ConventionForm";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import { EmailValidationInput } from "../../../commons/EmailValidationInput";
import { PhoneInput } from "../../../commons/PhoneInput";

export const EstablishmentRepresentativeFields = ({
  setEmailValidationErrors,
  emailValidationErrors,
  isConventionTemplate,
}: {
  setEmailValidationErrors: SetEmailValidationErrorsState;
  emailValidationErrors: EmailValidationErrorsState;
  isConventionTemplate: boolean;
}): JSX.Element => {
  const { getValues, register, formState, setValue } =
    useFormContext<ConventionReadDto>();
  const values = getValues();
  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: values.internshipKind,
      isConventionTemplate,
    }),
  );
  const getFieldError = makeFieldError(formState);
  const formContents = getFormFields();
  const isFetchingSiret = useAppSelector(siretSelectors.isFetching);
  const countryFromSiret = useAppSelector(siretSelectors.countryCode);

  return (
    <>
      <hr className={fr.cx("fr-hr")} />
      <Input
        label={
          formContents["signatories.establishmentRepresentative.firstName"]
            .label
        }
        hintText={
          formContents["signatories.establishmentRepresentative.firstName"]
            .hintText
        }
        nativeInputProps={{
          ...formContents["signatories.establishmentRepresentative.firstName"],
          ...register("signatories.establishmentRepresentative.firstName"),
        }}
        disabled={isFetchingSiret}
        {...getFieldError("signatories.establishmentRepresentative.firstName")}
      />
      <Input
        label={
          formContents["signatories.establishmentRepresentative.lastName"].label
        }
        hintText={
          formContents["signatories.establishmentRepresentative.lastName"]
            .hintText
        }
        nativeInputProps={{
          ...formContents["signatories.establishmentRepresentative.lastName"],
          ...register("signatories.establishmentRepresentative.lastName"),
        }}
        disabled={isFetchingSiret}
        {...getFieldError("signatories.establishmentRepresentative.lastName")}
      />
      <PhoneInput
        label={
          formContents["signatories.establishmentRepresentative.phone"].label
        }
        hintText={
          formContents["signatories.establishmentRepresentative.phone"].hintText
        }
        inputProps={{
          ...formContents["signatories.establishmentRepresentative.phone"],
          nativeInputProps: {
            ...register("signatories.establishmentRepresentative.phone"),
            id: formContents["signatories.establishmentRepresentative.phone"]
              .id,
            value: values.signatories.establishmentRepresentative?.phone,
          },
        }}
        disabled={isFetchingSiret}
        onPhoneNumberChange={(phoneNumber) => {
          setValue(
            "signatories.establishmentRepresentative.phone",
            phoneNumber,
            { shouldValidate: true },
          );
        }}
        shouldDisplaySelect={true}
        defaultCountryCodeValue={countryFromSiret ?? defaultCountryCode}
        stateRelatedMessage={
          getFieldError("signatories.establishmentRepresentative.phone")
            ?.stateRelatedMessage
        }
      />
      <EmailValidationInput
        label={
          formContents["signatories.establishmentRepresentative.email"].label
        }
        hintText={
          formContents["signatories.establishmentRepresentative.email"].hintText
        }
        nativeInputProps={{
          ...formContents["signatories.establishmentRepresentative.email"],
          ...register("signatories.establishmentRepresentative.email", {
            setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
          }),
          onBlur: (event) => {
            setValue(
              "signatories.establishmentRepresentative.email",
              toLowerCaseWithoutDiacritics(event.currentTarget.value),
            );
          },
        }}
        disabled={isFetchingSiret}
        {...getFieldError("signatories.establishmentRepresentative.email")}
        onEmailValidationFeedback={({ state, stateRelatedMessage }) => {
          const { "Responsable d'entreprise": _, ...rest } =
            emailValidationErrors;

          setEmailValidationErrors({
            ...rest,
            ...(state === "error"
              ? {
                  "Responsable d'entreprise": stateRelatedMessage,
                }
              : {}),
          });
        }}
      />
      {values.signatories.establishmentRepresentative?.email && (
        <ConventionEmailWarning shouldShowFtSpecificMessage={false} />
      )}
    </>
  );
};
