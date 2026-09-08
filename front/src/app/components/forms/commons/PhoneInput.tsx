import { fr } from "@codegouvfr/react-dsfr";
import { Input, type InputProps } from "@codegouvfr/react-dsfr/Input";
import { Select, type SelectProps } from "@codegouvfr/react-dsfr/SelectNext";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import {
  countryCodesData,
  defaultCountryCode,
  getCountryCodeFromPhoneNumber,
  isSupportedCountryCode,
  type OmitFromExistingKeys,
  type SupportedCountryCode,
  toInternationalPhoneNumber,
} from "shared";

export type PhoneInputProps = InputProps.RegularInput & {
  defaultCountryCodeValue?: SupportedCountryCode;
  shouldDisplaySelect?: boolean;
  selectProps?: OmitFromExistingKeys<
    SelectProps<SelectProps.Option<SupportedCountryCode>[]>,
    "label" | "options"
  >;
  inputProps?: InputProps.RegularInput;
  onPhoneNumberChange: (phoneNumber: string) => void;
};

export const PhoneInput = ({
  label,
  hintText,
  stateRelatedMessage,
  defaultCountryCodeValue = defaultCountryCode,
  shouldDisplaySelect = false,
  selectProps,
  inputProps,
  onPhoneNumberChange,
  id,
  disabled,
}: PhoneInputProps) => {
  const { setError } = useFormContext();
  const [countryCode, setCountryCode] = useState<SupportedCountryCode | null>(
    null,
  );
  const [displayedPhoneNumber, setDisplayedPhoneNumber] = useState<string>(
    inputProps?.nativeInputProps?.value?.toString() ?? "",
  );

  const phoneInputId = inputProps?.nativeInputProps?.id ?? id;
  const countrySelectId = phoneInputId ? `${phoneInputId}-country` : undefined;
  const errorMessageId = phoneInputId
    ? `${phoneInputId}-error-desc-error`
    : undefined;

  const getCountryCodeValue = () => {
    const countryCodeFromDisplayedNumber =
      getCountryCodeFromPhoneNumber(displayedPhoneNumber);
    if (countryCodeFromDisplayedNumber) {
      return countryCodeFromDisplayedNumber;
    }
    return countryCode || defaultCountryCodeValue;
  };

  const phoneInput = (
    <Input
      label={shouldDisplaySelect ? "Numéro de téléphone" : ""}
      hintText=""
      classes={shouldDisplaySelect ? { label: fr.cx("fr-sr-only") } : undefined}
      nativeInputProps={{
        ...inputProps?.nativeInputProps,
        ...(phoneInputId ? { id: phoneInputId } : {}),
        ...(stateRelatedMessage && errorMessageId
          ? { "aria-describedby": errorMessageId }
          : {}),
        onChange: (event) => {
          const updatedPhoneNumber = event.currentTarget.value;
          const countryCodeFromPhoneNumber =
            getCountryCodeFromPhoneNumber(updatedPhoneNumber);
          const shouldUpdateCountryCode =
            updatedPhoneNumber.includes("+") &&
            countryCodeFromPhoneNumber &&
            countryCodeFromPhoneNumber !== countryCode;
          inputProps?.nativeInputProps?.onChange?.(event);
          setDisplayedPhoneNumber(updatedPhoneNumber);
          if (shouldUpdateCountryCode) {
            setCountryCode(countryCodeFromPhoneNumber);
          }
        },
        onBlur: (event) => {
          const internationalPhoneNumber = toInternationalPhoneNumber(
            displayedPhoneNumber,
            countryCode || defaultCountryCodeValue,
          );
          if (internationalPhoneNumber) {
            onPhoneNumberChange(internationalPhoneNumber);
          }
          if (!internationalPhoneNumber) {
            setError(inputProps?.nativeInputProps?.name ?? "", {
              message: "Le numéro de téléphone n'est pas valide",
            });
          }
          inputProps?.nativeInputProps?.onBlur?.(event);
        },
        value: displayedPhoneNumber,
        type: "tel",
        disabled,
      }}
    />
  );

  const phoneInputWithCountrySelect = (
    <div className={fr.cx("fr-grid-row", "fr-mt-1w")}>
      {shouldDisplaySelect && (
        <div className={fr.cx("fr-col-12", "fr-col-md-5")}>
          <Select
            label={<span className={fr.cx("fr-sr-only")}>Indicatif</span>}
            options={Object.entries(countryCodesData).map(
              ([code, { name, flag }]) => ({
                value: code,
                label:
                  name === "France"
                    ? `${flag} ${name} (incl. DOM/TOM)`
                    : `${flag} ${name}`,
              }),
            )}
            nativeSelectProps={{
              ...selectProps?.nativeSelectProps,
              id: countrySelectId,
              value: getCountryCodeValue(),
              disabled,
              onChange: (event) => {
                const updatedCountryCode = event.currentTarget.value;
                if (isSupportedCountryCode(updatedCountryCode)) {
                  setCountryCode(updatedCountryCode);
                  setDisplayedPhoneNumber("");
                  onPhoneNumberChange("");
                }
              },
            }}
          />
        </div>
      )}

      <div
        className={fr.cx(
          "fr-col",
          shouldDisplaySelect && ["fr-ml-md-1w", "fr-mt-1w", "fr-mt-md-0"],
        )}
      >
        {phoneInput}
      </div>
    </div>
  );

  return (
    <div
      className={fr.cx("fr-input-group", "fr-mb-3w", {
        "fr-input-group--error": !!stateRelatedMessage,
      })}
    >
      {shouldDisplaySelect ? (
        <fieldset className={fr.cx("fr-fieldset")}>
          <div className={fr.cx("fr-fieldset__content")}>
            <legend className={fr.cx("fr-label")}>
              {label}
              {hintText && (
                <span className={fr.cx("fr-hint-text")}>{hintText}</span>
              )}
            </legend>
            {phoneInputWithCountrySelect}
          </div>
        </fieldset>
      ) : (
        <>
          <label className={fr.cx("fr-label")} htmlFor={phoneInputId}>
            {label}
          </label>
          {hintText && (
            <span className={fr.cx("fr-hint-text")}>{hintText}</span>
          )}
          {phoneInputWithCountrySelect}
        </>
      )}

      {stateRelatedMessage && (
        <p id={errorMessageId} className={fr.cx("fr-error-text")}>
          {stateRelatedMessage}
        </p>
      )}
    </div>
  );
};
