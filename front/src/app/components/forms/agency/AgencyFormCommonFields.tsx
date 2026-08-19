import { Input } from "@codegouvfr/react-dsfr/Input";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type AddressAndPosition,
  type AddressDto,
  type AddressWithCountryCodeAndPosition,
  addressDtoToString,
  type CreateAgencyDto,
  defaultCountryCode,
  domElementIds,
  emailSchema,
  type LookupAddress,
} from "shared";
import { AddressAutocomplete } from "src/app/components/forms/autocomplete/AddressAutocomplete";
import { MultipleEmailsInput } from "src/app/components/forms/commons/MultipleEmailsInput";
import { RadioGroup } from "src/app/components/forms/commons/RadioGroup";
import { formAgencyFieldsLabels } from "src/app/contents/forms/agency/formAgency";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useSiretFetcher } from "src/app/hooks/siret.hooks";
import { makeGeocodingLocatorSelector } from "src/core-logic/domain/geocoding/geocoding.selectors";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";

type AgencyFormCommonFieldsProps = {
  addressInitialValue?: AddressDto;
  refersToOtherAgency: boolean;
  mode: "edit" | "create";
  disableAgencyKeyFields: boolean;
};

type ValidationSteps = "validatorsOnly" | "counsellorsAndValidators";

export const AgencyFormCommonFields = ({
  refersToOtherAgency,
  mode,
  disableAgencyKeyFields,
}: AgencyFormCommonFieldsProps) => {
  const { getValues, setValue, register, formState, watch } =
    useFormContext<CreateAgencyDto>();
  const agencyAddress = useAppSelector(
    makeGeocodingLocatorSelector("agency-address"),
  );

  const dispatch = useDispatch();
  const formContents = getFormContents(formAgencyFieldsLabels).getFormFields();
  const getFieldError = makeFieldError(formState);

  const {
    updateSiret,
    siretErrorToDisplay,
    isFetchingSiret,
    establishmentInfos,
  } = useSiretFetcher({
    shouldThrowErrorOnAlreadySaved: false,
    addressAutocompleteLocator: "agency-address",
  });

  const agencyAddressWithDefaultCountryCodeAndPosition: AddressWithCountryCodeAndPosition =
    {
      address: {
        ...getValues("address"),
        countryCode: defaultCountryCode,
      },
      position: getValues("position"),
    };

  const formValues = getValues();
  const [validationSteps, setValidationSteps] = useState<ValidationSteps>(
    formValues.counsellorEmails.length || refersToOtherAgency
      ? "counsellorsAndValidators"
      : "validatorsOnly",
  );

  const shouldResetCounsellorEmails =
    validationSteps === "validatorsOnly" &&
    formValues.counsellorEmails.length > 0;
  if (shouldResetCounsellorEmails) setValue("counsellorEmails", []);

  const onAddressSelected = useCallback(
    (addressAndPosition: AddressAndPosition) => {
      setValue("address", addressAndPosition.address);
      setValue("position", addressAndPosition.position);
      setValue("coveredDepartments", [
        addressAndPosition.address.departmentCode,
      ]);
    },
    [setValue],
  );

  useEffect(() => {
    if (!isFetchingSiret && establishmentInfos && mode === "create") {
      setValue("name", establishmentInfos.businessName);
      dispatch(
        geocodingSlice.actions.fetchSuggestionsRequested({
          locator: "agency-address",
          lookup: establishmentInfos.businessAddress as LookupAddress,
          countryCode: defaultCountryCode,
          selectFirstSuggestion: true,
        }),
      );
    }
  }, [establishmentInfos, isFetchingSiret, setValue, dispatch, mode]);

  useEffect(() => {
    if (agencyAddress?.value) {
      onAddressSelected(agencyAddress.value);
    }
  }, [agencyAddress, onAddressSelected]);

  const shouldUpdateSiret = useMemo(
    () => formValues.agencySiret && mode === "create",
    [formValues.agencySiret, mode],
  );

  useEffect(() => {
    if (shouldUpdateSiret) {
      dispatch(
        siretSlice.actions.siretModified({
          siret: formValues.agencySiret,
          feedbackTopic: "siret-input",
          addressAutocompleteLocator: "agency-address",
        }),
      );
    }
  }, [dispatch, shouldUpdateSiret, formValues.agencySiret]);

  return (
    <>
      <Input
        label={formContents.agencySiret.label}
        hintText={formContents.agencySiret.hintText}
        disabled={disableAgencyKeyFields}
        nativeInputProps={{
          ...formContents.agencySiret,
          ...register("agencySiret"),
          onChange: (event) => {
            updateSiret(event.target.value);
            setValue("agencySiret", event.target.value);
          },
          readOnly: isFetchingSiret,
        }}
        state={
          formState.touchedFields.agencySiret && siretErrorToDisplay
            ? "error"
            : "default"
        }
        stateRelatedMessage={
          formState.touchedFields.agencySiret && siretErrorToDisplay
            ? siretErrorToDisplay
            : ""
        }
      />
      <Input
        label={formContents.name.label}
        hintText={formContents.name.hintText}
        nativeInputProps={{
          ...register("name"),
          ...formContents.name,
        }}
        {...getFieldError("name")}
        disabled={disableAgencyKeyFields}
      />
      <AddressAutocomplete
        countryCode={defaultCountryCode}
        locator="agency-address"
        {...formContents.address}
        selectProps={{
          inputId: domElementIds.addAgency.addressAutocomplete,
          inputValue: establishmentInfos?.businessAddress,
          defaultValue: {
            value: agencyAddressWithDefaultCountryCodeAndPosition,
            label: addressDtoToString(
              agencyAddressWithDefaultCountryCodeAndPosition.address,
            ),
          },
        }}
        onAddressSelected={onAddressSelected}
        onAddressClear={() => {
          setValue("address", {
            streetNumberAndAddress: "",
            postcode: "",
            departmentCode: "",
            city: "",
          });
          setValue("position", {
            lat: 0,
            lon: 0,
          });
          setValue("coveredDepartments", []);
        }}
        disabled={isFetchingSiret}
        {...getFieldError("address")}
      />
      <Input
        label={formContents.phoneNumber.label}
        hintText={formContents.phoneNumber.hintText}
        nativeInputProps={{
          ...register("phoneNumber"),
          ...formContents.phoneNumber,
        }}
        {...getFieldError("phoneNumber")}
      />
      <Input
        label={formContents.contactEmail.label}
        hintText={formContents.contactEmail.hintText}
        nativeInputProps={{
          ...register("contactEmail"),
          ...formContents.contactEmail,
        }}
        {...getFieldError("contactEmail")}
      />
      {!refersToOtherAgency && mode === "create" && (
        <RadioGroup
          {...formContents.stepsForValidation}
          options={numberOfStepsOptions}
          currentValue={validationSteps}
          setCurrentValue={setValidationSteps}
          groupLabel={formContents.stepsForValidation.label}
        />
      )}
      {mode === "create" &&
        (validationSteps === "counsellorsAndValidators" ||
          refersToOtherAgency) && (
          <MultipleEmailsInput
            {...formContents.counsellorEmails}
            initialValue={formValues.counsellorEmails.join(", ")}
            valuesInList={watch("counsellorEmails")}
            setValues={(values) => setValue("counsellorEmails", values)}
            validationSchema={emailSchema}
          />
        )}
      {mode === "create" && !refersToOtherAgency && (
        <MultipleEmailsInput
          {...formContents.validatorEmails}
          initialValue={formValues.validatorEmails.join(", ")}
          description={descriptionByValidationSteps[validationSteps]}
          valuesInList={watch("validatorEmails")}
          setValues={(values) => setValue("validatorEmails", values)}
          validationSchema={emailSchema}
        />
      )}
      <Input
        label={formContents.signature.label}
        hintText={formContents.signature.hintText}
        nativeInputProps={{
          ...register("signature"),
          ...formContents.signature,
        }}
        {...getFieldError("signature")}
      />
    </>
  );
};

const numberOfStepsOptions: { label: string; value: ValidationSteps }[] = [
  {
    label: "1: La convention est examinée et validée par la même personne",
    value: "validatorsOnly",
  },
  {
    label:
      "2: La convention est examinée par une personne puis validée par quelqu'un d'autre",
    value: "counsellorsAndValidators",
  },
];

const descriptionByValidationSteps: Record<ValidationSteps, ReactNode> = {
  validatorsOnly: formAgencyFieldsLabels.counsellorEmails.hintText,
  counsellorsAndValidators: formAgencyFieldsLabels.validatorEmails.hintText,
};
