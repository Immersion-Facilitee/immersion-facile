import { Input } from "@codegouvfr/react-dsfr/Input";

import { useFormContext } from "react-hook-form";
import type { ConventionReadDto } from "shared";
import { PhoneInput } from "src/app/components/forms/commons/PhoneInput";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";

export const BeneficiaryEmergencyContactFields = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}): JSX.Element => {
  const { watch, register, setValue, formState } =
    useFormContext<ConventionReadDto>();

  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: watch().internshipKind,
      isConventionTemplate,
    }),
  );
  const getFieldError = makeFieldError(formState);
  const formContents = getFormFields();
  return (
    <>
      <Input
        label={formContents["signatories.beneficiary.emergencyContact"].label}
        hintText={
          formContents["signatories.beneficiary.emergencyContact"].hintText
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiary.emergencyContact"],
          ...register("signatories.beneficiary.emergencyContact"),
        }}
        {...getFieldError("signatories.beneficiary.emergencyContact")}
      />
      <PhoneInput
        label={
          formContents["signatories.beneficiary.emergencyContactPhone"].label
        }
        hintText={
          formContents["signatories.beneficiary.emergencyContactPhone"].hintText
        }
        inputProps={{
          ...formContents["signatories.beneficiary.emergencyContactPhone"],
          nativeInputProps: {
            ...register("signatories.beneficiary.emergencyContactPhone"),
            id: formContents["signatories.beneficiary.emergencyContactPhone"]
              .id,
            value: watch("signatories.beneficiary.emergencyContactPhone"),
          },
        }}
        onPhoneNumberChange={(phoneNumber) => {
          setValue(
            "signatories.beneficiary.emergencyContactPhone",
            phoneNumber,
          );
        }}
        {...getFieldError("signatories.beneficiary.emergencyContactPhone")}
      />
      <Input
        label={
          formContents["signatories.beneficiary.emergencyContactEmail"].label
        }
        hintText={
          formContents["signatories.beneficiary.emergencyContactEmail"].hintText
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiary.emergencyContactEmail"],
          ...register("signatories.beneficiary.emergencyContactEmail"),
        }}
        {...getFieldError("signatories.beneficiary.emergencyContactEmail")}
      />
    </>
  );
};
