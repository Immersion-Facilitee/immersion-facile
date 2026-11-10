import { Input } from "@codegouvfr/react-dsfr/Input";
import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { type ConventionReadDto, domElementIds } from "shared";
import { AppellationAutocomplete } from "src/app/components/forms/autocomplete/AppellationAutocomplete";

type ConventionFormProfessionProps = {
  label: string;
  hintText?: ReactNode;
  disabled?: boolean;
};

export const ConventionFormProfession = ({
  label,
  hintText,
  disabled,
}: ConventionFormProfessionProps) => {
  const {
    setValue,
    formState: { errors, submitCount },
    getValues,
  } = useFormContext<ConventionReadDto>();

  const appellationErrorMessage =
    errors.immersionAppellation?.message ??
    errors.immersionAppellation?.appellationLabel?.message;
  const showAppellationError =
    appellationErrorMessage !== undefined && submitCount > 0;

  if (disabled)
    return (
      <Input
        label={label}
        nativeInputProps={{
          name: "immersionAppellation",
          value: getValues().immersionAppellation?.appellationLabel,
        }}
        disabled
      />
    );
  return (
    <AppellationAutocomplete
      locator="convention-profession"
      label={label}
      selectProps={{
        inputId:
          domElementIds.conventionImmersion.conventionSection
            .immersionAppellation,
      }}
      onAppellationSelected={(appellation) => {
        setValue("immersionAppellation.romeCode", appellation.romeCode);
        setValue("immersionAppellation.romeLabel", appellation.romeLabel);
        setValue(
          "immersionAppellation.appellationCode",
          appellation.appellationCode,
        );
        setValue(
          "immersionAppellation.appellationLabel",
          appellation.appellationLabel,
          { shouldValidate: true },
        );
      }}
      hintText={hintText}
      onAppellationClear={() => {
        setValue("immersionAppellation.romeCode", "");
        setValue("immersionAppellation.romeLabel", "");
        setValue("immersionAppellation.appellationCode", "");
        setValue("immersionAppellation.appellationLabel", "", {
          shouldValidate: true,
        });
      }}
      state={showAppellationError ? "error" : undefined}
      stateRelatedMessage={
        showAppellationError ? appellationErrorMessage : undefined
      }
    />
  );
};
