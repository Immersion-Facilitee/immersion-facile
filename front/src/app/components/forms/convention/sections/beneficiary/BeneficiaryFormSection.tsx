import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  addressDtoToString,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  type ConventionReadDto,
  type DateString,
  defaultCountryCode,
  domElementIds,
  emailSchema,
  type InternshipKind,
  isBeneficiaryMinorAccordingToAge,
  isBeneficiaryStudent,
  levelsOfEducation,
  toLowerCaseWithoutDiacritics,
} from "shared";
import { AddressAutocomplete } from "src/app/components/forms/autocomplete/AddressAutocomplete";
import { PhoneInput } from "src/app/components/forms/commons/PhoneInput";
import { ConventionEmailWarning } from "src/app/components/forms/convention/ConventionEmailWarning";
import type {
  EmailValidationErrorsState,
  SetEmailValidationErrorsState,
} from "src/app/components/forms/convention/ConventionForm";
import { booleanSelectOptions } from "src/app/contents/forms/common/values";
import { formConventionFieldsLabels } from "src/app/contents/forms/convention/formConvention";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { conventionSlice } from "src/core-logic/domain/convention/convention.slice";
import { EmailValidationInput } from "../../../commons/EmailValidationInput";
import { BeneficiaryCurrentEmployerFields } from "./BeneficiaryCurrentEmployerFields";
import { BeneficiaryEmergencyContactFields } from "./BeneficiaryEmergencyContactFields";
import { BeneficiaryRepresentativeFields } from "./BeneficiaryRepresentativeFields";

type beneficiaryFormSectionProperties = {
  internshipKind: InternshipKind;
  setEmailValidationErrors: SetEmailValidationErrorsState;
  emailValidationErrors: EmailValidationErrorsState;
  fromFtConnectedUser?: boolean;
  isConventionTemplate: boolean;
};

export const BeneficiaryFormSection = ({
  internshipKind,
  setEmailValidationErrors,
  emailValidationErrors,
  fromFtConnectedUser,
  isConventionTemplate,
}: beneficiaryFormSectionProperties): JSX.Element => {
  const [isMinorAccordingToAge, setIsMinorAccordingToAge] = useState(false);
  const isMinorOrProtected = useAppSelector(conventionSelectors.isMinor);
  const hasCurrentEmployer = useAppSelector(
    conventionSelectors.hasCurrentEmployer,
  );
  const { register, getValues, setValue, formState } =
    useFormContext<ConventionReadDto>();
  const values = getValues();
  const dispatch = useDispatch();
  const getFieldError = makeFieldError(formState);
  const { getFormFields } = getFormContents(
    formConventionFieldsLabels({
      internshipKind: values.internshipKind,
      isConventionTemplate,
    }),
  );
  const formContents = getFormFields();

  useEffect(() => {
    if (
      hasBeneficiaryRepresentativeData(
        values.signatories.beneficiaryRepresentative,
      ) &&
      !isMinorOrProtected
    ) {
      dispatch(conventionSlice.actions.isMinorChanged(true));
    }
  }, [
    dispatch,
    values.signatories.beneficiaryRepresentative,
    isMinorOrProtected,
  ]);

  useEffect(() => {
    if (
      hasBeneficiaryCurrentEmployerData(
        values.signatories.beneficiaryCurrentEmployer,
      ) &&
      !hasCurrentEmployer
    ) {
      dispatch(conventionSlice.actions.isCurrentEmployerChanged(true));
    }
  }, [
    hasCurrentEmployer,
    dispatch,
    values.signatories.beneficiaryCurrentEmployer,
  ]);

  const levelsOfEducationToSelectOption = levelsOfEducation.map(
    (level: string) => ({ label: level, value: level }),
  );

  const onBirthdateChange = useCallback(
    (beneficiaryBirthdate: DateString) => {
      const newIsMinor = isBeneficiaryMinorAccordingToAge(
        values.dateStart,
        beneficiaryBirthdate,
      );
      if (newIsMinor) {
        setValue(
          "signatories.beneficiaryRepresentative.role",
          "beneficiary-representative",
        );
      }

      if (!newIsMinor && !isMinorOrProtected) {
        setValue("signatories.beneficiaryRepresentative", undefined);
      }
      setIsMinorAccordingToAge(newIsMinor);
      dispatch(conventionSlice.actions.isMinorChanged(newIsMinor));
    },
    [dispatch, values.dateStart, setValue],
  );

  useEffect(() => {
    if (values.signatories.beneficiary.birthdate) {
      onBirthdateChange(values.signatories.beneficiary.birthdate);
    }
  }, [onBirthdateChange, values.signatories.beneficiary.birthdate]);

  return (
    <>
      <Input
        hintText={formContents["signatories.beneficiary.firstName"].hintText}
        label={formContents["signatories.beneficiary.firstName"].label}
        nativeInputProps={{
          ...formContents["signatories.beneficiary.firstName"],
          ...register("signatories.beneficiary.firstName"),
        }}
        disabled={fromFtConnectedUser}
        {...getFieldError("signatories.beneficiary.firstName")}
      />
      <Input
        hintText={formContents["signatories.beneficiary.lastName"].hintText}
        label={formContents["signatories.beneficiary.lastName"].label}
        nativeInputProps={{
          ...formContents["signatories.beneficiary.lastName"],
          ...register("signatories.beneficiary.lastName"),
        }}
        disabled={fromFtConnectedUser}
        {...getFieldError("signatories.beneficiary.lastName")}
      />

      <Input
        hintText={formContents["signatories.beneficiary.birthdate"].hintText}
        label={formContents["signatories.beneficiary.birthdate"].label}
        nativeInputProps={{
          ...formContents["signatories.beneficiary.birthdate"],
          ...register("signatories.beneficiary.birthdate"),
          onBlur: (event) => {
            onBirthdateChange(event.currentTarget.value);
          },
          type: "date",
          max: "9999-12-31",
        }}
        disabled={fromFtConnectedUser}
        {...getFieldError("signatories.beneficiary.birthdate")}
      />
      <EmailValidationInput
        hintText={formContents["signatories.beneficiary.email"].hintText}
        label={formContents["signatories.beneficiary.email"].label}
        disabled={
          fromFtConnectedUser &&
          emailSchema.safeParse(values.signatories.beneficiary.email).success
        }
        nativeInputProps={{
          ...formContents["signatories.beneficiary.email"],
          ...register("signatories.beneficiary.email", {
            setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
          }),
          onBlur: (event) => {
            setValue(
              "signatories.beneficiary.email",
              toLowerCaseWithoutDiacritics(event.currentTarget.value),
            );
          },
        }}
        {...getFieldError("signatories.beneficiary.email")}
        onEmailValidationFeedback={({ state, stateRelatedMessage }) => {
          const { Bénéficiaire: _, ...rest } = emailValidationErrors;

          setEmailValidationErrors({
            ...rest,
            ...(state === "error"
              ? {
                  Bénéficiaire: stateRelatedMessage,
                }
              : {}),
          });
        }}
      />

      {values.signatories.beneficiary.email && (
        <ConventionEmailWarning
          shouldShowFtSpecificMessage={values.agencyKind === "france-travail"}
        />
      )}
      <PhoneInput
        label={formContents["signatories.beneficiary.phone"].label}
        hintText={formContents["signatories.beneficiary.phone"].hintText}
        inputProps={{
          ...formContents["signatories.beneficiary.phone"],
          nativeInputProps: {
            ...register("signatories.beneficiary.phone"),
            id: formContents["signatories.beneficiary.phone"].id,
            value: values.signatories.beneficiary.phone,
          },
        }}
        onPhoneNumberChange={(phoneNumber) => {
          setValue("signatories.beneficiary.phone", phoneNumber);
        }}
        {...getFieldError("signatories.beneficiary.phone")}
      />
      {values.internshipKind === "mini-stage-cci" && (
        <>
          <AddressAutocomplete
            countryCode={defaultCountryCode}
            locator="convention-beneficiary-address"
            {...formContents["signatories.beneficiary.address"]}
            initialInputValue={
              values.signatories.beneficiary.address &&
              addressDtoToString(values.signatories.beneficiary.address)
            }
            onAddressSelected={(addressAndPosition) => {
              setValue(
                "signatories.beneficiary.address.city",
                addressAndPosition.address.city,
              );
              setValue(
                "signatories.beneficiary.address.postcode",
                addressAndPosition.address.postcode,
              );
              setValue(
                "signatories.beneficiary.address.streetNumberAndAddress",
                addressAndPosition.address.streetNumberAndAddress,
              );
              setValue(
                "signatories.beneficiary.address.departmentCode",
                addressAndPosition.address.departmentCode,
              );
            }}
            onAddressClear={() => {
              setValue("signatories.beneficiary.address", undefined);
            }}
            id={domElementIds.conventionImmersion.beneficiarySection.address}
            {...getFieldError("signatories.beneficiary.address")}
          />
          <Select
            label={
              formContents["signatories.beneficiary.levelOfEducation"].label
            }
            hint={
              formContents["signatories.beneficiary.levelOfEducation"].hintText
            }
            options={levelsOfEducationToSelectOption}
            nativeSelectProps={{
              ...formContents["signatories.beneficiary.levelOfEducation"],
              ...register("signatories.beneficiary.levelOfEducation"),
              value: isBeneficiaryStudent(values.signatories.beneficiary)
                ? values.signatories.beneficiary.levelOfEducation
                : "",
            }}
            {...getFieldError("signatories.beneficiary.levelOfEducation")}
          />

          <Input
            label={formContents["signatories.beneficiary.schoolName"].label}
            hintText={
              formContents["signatories.beneficiary.schoolName"].hintText
            }
            nativeInputProps={{
              ...formContents["signatories.beneficiary.schoolName"],
              ...register("signatories.beneficiary.schoolName"),
            }}
            {...getFieldError("signatories.beneficiary.schoolName")}
          />

          <Input
            label={formContents["signatories.beneficiary.schoolPostcode"].label}
            hintText={
              formContents["signatories.beneficiary.schoolPostcode"].hintText
            }
            nativeInputProps={{
              ...formContents["signatories.beneficiary.schoolPostcode"],
              ...register("signatories.beneficiary.schoolPostcode"),
            }}
            {...getFieldError("signatories.beneficiary.schoolPostcode")}
          />
        </>
      )}
      <Input
        label={formContents["signatories.beneficiary.financiaryHelp"].label}
        hintText={
          formContents["signatories.beneficiary.financiaryHelp"].hintText
        }
        textArea
        nativeTextAreaProps={{
          ...formContents["signatories.beneficiary.financiaryHelp"],
          ...register("signatories.beneficiary.financiaryHelp"),
        }}
        {...getFieldError("signatories.beneficiary.financiaryHelp")}
      />
      {!isMinorAccordingToAge && (
        <RadioButtons
          legend={formContents.isMinor.label}
          hintText={formContents.isMinor.hintText}
          id={formContents.isMinor.id}
          options={booleanSelectOptions.map((option) => ({
            ...option,
            nativeInputProps: {
              ...option.nativeInputProps,
              checked:
                Boolean(option.nativeInputProps.value) === isMinorOrProtected,
              onChange: () => {
                const value = Boolean(option.nativeInputProps.value);
                dispatch(conventionSlice.actions.isMinorChanged(value));
                setValue(
                  "signatories.beneficiaryRepresentative",
                  value
                    ? {
                        firstName: "",
                        lastName: "",
                        phone: "",
                        email: "",
                        role: "beneficiary-representative",
                      }
                    : undefined,
                );
              },
            },
          }))}
        />
      )}

      {isMinorOrProtected && (
        <BeneficiaryRepresentativeFields
          setEmailValidationErrors={setEmailValidationErrors}
          emailValidationErrors={emailValidationErrors}
          isConventionTemplate={isConventionTemplate}
        />
      )}

      <RadioButtons
        legend={formContents["signatories.beneficiary.isRqth"].label}
        hintText={formContents["signatories.beneficiary.isRqth"].hintText}
        options={booleanSelectOptions.map((option) => ({
          ...option,
          nativeInputProps: {
            ...option.nativeInputProps,
            checked:
              Boolean(option.nativeInputProps.value) ===
              values.signatories.beneficiary.isRqth,
            onChange: () => {
              setValue(
                "signatories.beneficiary.isRqth",
                Boolean(option.nativeInputProps.value),
                { shouldValidate: true },
              );
            },
          },
        }))}
      />

      {!isMinorOrProtected && (
        <BeneficiaryEmergencyContactFields
          isConventionTemplate={isConventionTemplate}
        />
      )}

      {internshipKind !== "mini-stage-cci" && (
        <>
          <RadioButtons
            legend={formContents.isCurrentEmployer.label}
            hintText={formContents.isCurrentEmployer.hintText}
            id={formContents.isCurrentEmployer.id}
            options={booleanSelectOptions.map((option) => ({
              ...option,
              nativeInputProps: {
                ...option.nativeInputProps,
                checked:
                  Boolean(option.nativeInputProps.value) === hasCurrentEmployer,
                onChange: () => {
                  const value = Boolean(option.nativeInputProps.value);
                  dispatch(
                    conventionSlice.actions.isCurrentEmployerChanged(value),
                  );
                  setValue(
                    "signatories.beneficiaryCurrentEmployer",
                    value
                      ? {
                          firstName: "",
                          lastName: "",
                          phone: "",
                          email: "",
                          businessName: "",
                          businessSiret: "",
                          job: "",
                          businessAddress: "",
                          role: "beneficiary-current-employer",
                        }
                      : undefined,
                  );
                },
              },
            }))}
          />

          {hasCurrentEmployer && (
            <BeneficiaryCurrentEmployerFields
              isConventionTemplate={isConventionTemplate}
              emailValidationErrors={emailValidationErrors}
              setEmailValidationErrors={setEmailValidationErrors}
            />
          )}
        </>
      )}
    </>
  );
};

const hasBeneficiaryRepresentativeData = (
  beneficiaryRepresentative: BeneficiaryRepresentative | undefined,
): beneficiaryRepresentative is BeneficiaryRepresentative => {
  return !!(
    beneficiaryRepresentative &&
    (beneficiaryRepresentative.firstName ||
      beneficiaryRepresentative.lastName ||
      beneficiaryRepresentative.phone ||
      beneficiaryRepresentative.email)
  );
};

const hasBeneficiaryCurrentEmployerData = (
  beneficiaryCurrentEmployer: BeneficiaryCurrentEmployer | undefined,
): beneficiaryCurrentEmployer is BeneficiaryCurrentEmployer => {
  return !!(
    beneficiaryCurrentEmployer &&
    (beneficiaryCurrentEmployer.firstName ||
      beneficiaryCurrentEmployer.lastName ||
      beneficiaryCurrentEmployer.phone ||
      beneficiaryCurrentEmployer.email ||
      beneficiaryCurrentEmployer.businessName ||
      beneficiaryCurrentEmployer.businessSiret ||
      beneficiaryCurrentEmployer.job ||
      beneficiaryCurrentEmployer.businessAddress)
  );
};
