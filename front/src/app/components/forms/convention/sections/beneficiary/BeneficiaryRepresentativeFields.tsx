import { Input } from "@codegouvfr/react-dsfr/Input";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import {
  type ConventionReadDto,
  filterNotFalsy,
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
import { EmailValidationInput } from "../../../commons/EmailValidationInput";
import { PhoneInput } from "../../../commons/PhoneInput";

type BeneficiaryRepresentativeFieldsProps = {
  disabled?: boolean;
  setEmailValidationErrors: SetEmailValidationErrorsState;
  emailValidationErrors: EmailValidationErrorsState;
  isConventionTemplate: boolean;
};

export const BeneficiaryRepresentativeFields = ({
  disabled,
  setEmailValidationErrors,
  emailValidationErrors,
  isConventionTemplate,
}: BeneficiaryRepresentativeFieldsProps) => {
  const { register, getValues, setValue, watch, formState } =
    useFormContext<ConventionReadDto>();
  const values = getValues();
  const currentValues = watch();
  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: values.internshipKind,
      isConventionTemplate,
    }),
  );
  const beneficiaryRepresentativeFirstName =
    currentValues.signatories.beneficiaryRepresentative?.firstName;
  const beneficiaryRepresentativeLastName =
    currentValues.signatories.beneficiaryRepresentative?.lastName;
  const beneficiaryRepresentativePhone =
    currentValues.signatories.beneficiaryRepresentative?.phone;
  const beneficiaryRepresentativeEmail =
    currentValues.signatories.beneficiaryRepresentative?.email;
  const getFieldError = makeFieldError(formState);

  useEffect(() => {
    setValue(
      "signatories.beneficiary.emergencyContact",
      [beneficiaryRepresentativeFirstName, beneficiaryRepresentativeLastName]
        .filter(filterNotFalsy)
        .join(" ") || undefined,
    );
  }, [
    beneficiaryRepresentativeFirstName,
    beneficiaryRepresentativeLastName,
    setValue,
  ]);

  useEffect(() => {
    setValue(
      "signatories.beneficiary.emergencyContactPhone",
      beneficiaryRepresentativePhone || "",
    );
  }, [beneficiaryRepresentativePhone, setValue]);

  useEffect(() => {
    setValue(
      "signatories.beneficiary.emergencyContactEmail",
      beneficiaryRepresentativeEmail || "",
    );
  }, [beneficiaryRepresentativeEmail, setValue]);

  const formContents = getFormFields();
  return (
    <>
      <input
        type="hidden"
        defaultValue="beneficiary-representative"
        {...register("signatories.beneficiaryRepresentative.role")}
      />
      <Input
        label={
          formContents["signatories.beneficiaryRepresentative.firstName"].label
        }
        hintText={
          formContents["signatories.beneficiaryRepresentative.firstName"]
            .hintText
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiaryRepresentative.firstName"],
          ...register("signatories.beneficiaryRepresentative.firstName"),
        }}
        disabled={disabled}
        {...getFieldError("signatories.beneficiaryRepresentative.firstName")}
      />
      <Input
        label={
          formContents["signatories.beneficiaryRepresentative.lastName"].label
        }
        hintText={
          formContents["signatories.beneficiaryRepresentative.lastName"]
            .hintText
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiaryRepresentative.lastName"],
          ...register("signatories.beneficiaryRepresentative.lastName"),
        }}
        disabled={disabled}
        {...getFieldError("signatories.beneficiaryRepresentative.lastName")}
      />
      <EmailValidationInput
        label={
          formContents["signatories.beneficiaryRepresentative.email"].label
        }
        hintText={
          formContents["signatories.beneficiaryRepresentative.email"].hintText
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiaryRepresentative.email"],
          ...register("signatories.beneficiaryRepresentative.email", {
            setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
          }),
          onBlur: (event) => {
            setValue(
              "signatories.beneficiaryRepresentative.email",
              toLowerCaseWithoutDiacritics(event.currentTarget.value),
            );
          },
        }}
        {...getFieldError("signatories.beneficiaryRepresentative.email")}
        onEmailValidationFeedback={({ state, stateRelatedMessage }) => {
          const { "Représentant légal du bénéficiaire": _, ...rest } =
            emailValidationErrors;

          setEmailValidationErrors({
            ...rest,
            ...(state === "error"
              ? {
                  "Représentant légal du bénéficiaire": stateRelatedMessage,
                }
              : {}),
          });
        }}
      />
      {values.signatories.beneficiaryRepresentative?.email && (
        <ConventionEmailWarning shouldShowFtSpecificMessage={false} />
      )}
      <PhoneInput
        label={
          formContents["signatories.beneficiaryRepresentative.phone"].label
        }
        hintText={
          formContents["signatories.beneficiaryRepresentative.phone"].hintText
        }
        inputProps={{
          ...formContents["signatories.beneficiaryRepresentative.phone"],
          nativeInputProps: {
            ...register("signatories.beneficiaryRepresentative.phone"),
            id: formContents["signatories.beneficiaryRepresentative.phone"].id,
            value: values.signatories.beneficiaryRepresentative?.phone,
          },
        }}
        onPhoneNumberChange={(phoneNumber) => {
          setValue("signatories.beneficiaryRepresentative.phone", phoneNumber);
        }}
        disabled={disabled}
        {...getFieldError("signatories.beneficiaryRepresentative.phone")}
      />
    </>
  );
};
