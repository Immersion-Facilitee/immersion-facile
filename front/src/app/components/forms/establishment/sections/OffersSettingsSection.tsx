import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import Input from "@codegouvfr/react-dsfr/Input";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import Select, { type SelectProps } from "@codegouvfr/react-dsfr/SelectNext";
import { equals } from "ramda";
import { useEffect, useState } from "react";
import { HeadingSection } from "react-design-system";
import { useFormContext } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  addressDtoToString,
  type ContactMode,
  type DotNestedKeys,
  domElementIds,
  type EstablishmentSearchableBy,
  type FormEstablishmentDto,
  type FormEstablishmentUserRight,
  getFormattedFirstnameAndLastname,
  immersionFacileContactEmail,
  onlyUserRightWithStatusAccepted,
  toDateUTCString,
  toDisplayedDate,
  toDisplayedPhoneNumber,
} from "shared";
import { AddressAutocomplete } from "src/app/components/forms/autocomplete/AddressAutocomplete";
import {
  booleanSelectOptions,
  richBooleanSelectOptions,
} from "src/app/contents/forms/common/values";
import {
  formEstablishmentFieldsLabels,
  mailtoHref,
} from "src/app/contents/forms/establishment/formEstablishment";
import {
  getFormContents,
  makeFieldError,
} from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { type Mode, useEstablishmentRoute } from "src/app/routes/routes.hooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { makeGeocodingLocatorSelector } from "src/core-logic/domain/geocoding/geocoding.selectors";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import { match, P } from "ts-pattern";
import allUsersSvg from "../../../../../assets/img/all.svg";
import jobSeekerSvg from "../../../../../assets/img/jobseeker.svg";
import mailSvg from "../../../../../assets/img/mail.svg";
import phoneSvg from "../../../../../assets/img/phone.svg";
import studentSvg from "../../../../../assets/img/student.svg";
import userSvg from "../../../../../assets/img/user.svg";
import type { OnStepChange, Step } from "../EstablishmentForm";

const searchableByValues: Record<
  "all" | keyof EstablishmentSearchableBy,
  EstablishmentSearchableBy
> = {
  all: {
    jobSeekers: true,
    students: true,
  },
  jobSeekers: {
    jobSeekers: true,
    students: false,
  },
  students: {
    jobSeekers: false,
    students: true,
  },
};

export const OffersSettingsSection = ({
  onStepChange,
  currentStep,
  mode,
  availableForImmersion: availableForImmersionInProps,
  setAvailableForImmersion,
  shouldUpdateAvailability,
}: {
  onStepChange: OnStepChange;
  currentStep: Step;
  mode: Mode;
  availableForImmersion: boolean | undefined;
  setAvailableForImmersion: (value: boolean) => void;
  shouldUpdateAvailability: boolean | undefined;
}) => {
  const { setValue, watch, clearErrors, getValues, register, formState } =
    useFormContext<FormEstablishmentDto>();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const route = useEstablishmentRoute();
  const isEstablishmentAdmin = route.name === "adminEstablishments";

  const dispatch = useDispatch();
  const isStepMode = currentStep !== null;

  const formContents = getFormContents(
    formEstablishmentFieldsLabels(mode),
  ).getFormFields();
  const getFieldError = makeFieldError(formState);

  const [currentStepSubmitted, setCurrentStepSubmitted] = useState(false);

  const showErrorOnAvailableForImmersion = () => {
    if (currentStepSubmitted) {
      if (availableForImmersionInProps === undefined) return true;
      if (availableForImmersionInProps && getFieldError("maxContactsPerMonth"))
        return true;
      if (
        availableForImmersionInProps === false &&
        (getFieldError("nextAvailabilityDate") ||
          getFieldError("maxContactsPerMonth"))
      )
        return true;
    }
    return false;
  };

  const shouldShowErrorOnAvailableForImmersion =
    showErrorOnAvailableForImmersion();

  const currentNextAvailabilityDate = getValues("nextAvailabilityDate");

  const currentValueFormatted =
    currentNextAvailabilityDate &&
    toDateUTCString(new Date(currentNextAvailabilityDate));

  const isAvailableForImmersion = () => {
    if (availableForImmersionInProps !== undefined)
      return availableForImmersionInProps;
    if (mode === "create" || shouldUpdateAvailability) return undefined;
    if (currentNextAvailabilityDate === undefined) return true;
    if (currentNextAvailabilityDate < new Date().toISOString())
      return undefined;
    return false;
  };

  const onClickEstablishmentDeleteButton = () => {
    const confirmed = confirm(
      `! Etes-vous sûr de vouloir supprimer cet établissement ? !
                (cette opération est irréversible 💀)`,
    );
    if (confirmed && connectedUserJwt)
      dispatch(
        establishmentSlice.actions.deleteEstablishmentRequested({
          establishmentDelete: {
            siret: formValues.siret,
            jwt: connectedUserJwt,
          },
          feedbackTopic: "form-establishment",
        }),
      );
    if (confirmed && !connectedUserJwt) alert("Vous n'êtes pas admin.");
  };

  const availableForImmersion = isAvailableForImmersion();
  const formValues = getValues();

  return (
    <>
      <HeadingSection
        title="Disponibilité"
        description="Êtes-vous disponible actuellement pour recevoir des personnes en immersion ? *"
      >
        <RadioButtons
          id={domElementIds.formEstablishment[mode].availabilityButton}
          name="availableForImmersion"
          options={richBooleanSelectOptions.map((option) => ({
            ...option,
            nativeInputProps: {
              ...option.nativeInputProps,
              checked:
                Boolean(option.nativeInputProps.value) ===
                availableForImmersion,
              onChange: () => {
                const isAvailable = option.nativeInputProps.value === 1;
                clearErrors("nextAvailabilityDate");
                clearErrors("maxContactsPerMonth");
                setAvailableForImmersion(isAvailable);
                if (isAvailable) {
                  setValue("nextAvailabilityDate", undefined);
                }
              },
            },
          }))}
          state={shouldShowErrorOnAvailableForImmersion ? "error" : "default"}
          stateRelatedMessage={
            shouldShowErrorOnAvailableForImmersion
              ? "Veuillez remplir ce champ"
              : null
          }
        />

        {availableForImmersion === false && (
          <Input
            label={formContents.nextAvailabilityDate.label}
            nativeInputProps={{
              id: formContents.nextAvailabilityDate.id,
              defaultValue: currentValueFormatted,
              required: true,
              onBlur: (event) => {
                setValue(
                  "nextAvailabilityDate",
                  new Date(event.currentTarget.value).toISOString(),
                  {
                    shouldValidate: true,
                  },
                );
              },
              onChange: () => {},
              type: "date",
              min: toDateUTCString(new Date()),
            }}
            {...getFieldError("nextAvailabilityDate")}
          />
        )}
        {availableForImmersion !== undefined && (
          <Input
            label={
              availableForImmersion
                ? formContents.maxContactsPerMonth.label
                : formContents.maxContactsPerMonthWhenAvailable.label
            }
            hintText={formContents.maxContactsPerMonth.hintText}
            nativeInputProps={{
              ...formContents.maxContactsPerMonth,
              ...register("maxContactsPerMonth", {
                valueAsNumber: true,
              }),
              type: "number",
              min: 1,
              pattern: "\\d*",
            }}
            {...getFieldError("maxContactsPerMonth")}
          />
        )}
        {mode === "admin" && (
          <Alert
            severity="info"
            title="Actuellement"
            description={
              <p>
                Mise en relation max/mois :{" "}
                <span
                  id={
                    domElementIds.formEstablishment.admin
                      .maxContactsPerMonthValue
                  }
                >
                  {getValues().maxContactsPerMonth}
                </span>{" "}
                <br />
                Prochaine disponibilité :{" "}
                {currentNextAvailabilityDate ? (
                  <>
                    à partir du{" "}
                    <span
                      id={
                        domElementIds.formEstablishment.admin
                          .nextAvailabilityDateValue
                      }
                    >
                      {toDisplayedDate({
                        date: new Date(currentNextAvailabilityDate),
                      })}
                    </span>
                  </>
                ) : (
                  "tout le temps"
                )}
              </p>
            }
            small={true}
          />
        )}
        {availableForImmersion === false && mode === "edit" && (
          <div className={fr.cx("fr-highlight", "fr-ml-0")}>
            <p>
              Vous pouvez demander la suppression définitive de votre entreprise{" "}
              <a href={mailtoHref(getValues().siret)}>en cliquant ici</a>.{" "}
              <br />
              Si vous avez besoin d'aide, envoyez un email à{" "}
              <a href={mailtoHref(immersionFacileContactEmail)}>
                {immersionFacileContactEmail}
              </a>
              .
            </p>
          </div>
        )}
      </HeadingSection>

      <HeadingSection
        title="Type de candidats"
        description="Quelle catégorie de public souhaitez-vous recevoir en immersion ?"
      >
        <RadioButtons
          name="searchableBy"
          id={domElementIds.formEstablishment[mode].searchableBy}
          options={searchableByOptions.map((option) => ({
            ...option,
            nativeInputProps: {
              ...option.nativeInputProps,
              checked: equals(
                watch("searchableBy"),
                searchableByValues[
                  option.nativeInputProps
                    .value as keyof typeof searchableByValues
                ],
              ),
              onChange: (event) => {
                const value = event.target.value;
                setValue(
                  "searchableBy",
                  searchableByValues[value as keyof typeof searchableByValues],
                );
              },
            },
          }))}
        />

        <RadioButtons
          {...formContents.fitForDisabledWorkers}
          legend={formContents.fitForDisabledWorkers.label}
          options={booleanSelectOptions.map((option) => ({
            ...option,
            nativeInputProps: {
              ...option.nativeInputProps,
              checked:
                (Boolean(option.nativeInputProps.value) === true &&
                  ["yes-declared-only", "yes-ft-certified"].includes(
                    formValues.fitForDisabledWorkers,
                  )) ||
                (Boolean(option.nativeInputProps.value) === false &&
                  formValues.fitForDisabledWorkers === "no"),
              onChange: () => {
                setValue(
                  "fitForDisabledWorkers",
                  option.nativeInputProps.value === 1
                    ? "yes-declared-only"
                    : "no",
                );
              },
            },
          }))}
        />
        <HeadingSection title="Moyen de contact">
          <ContactModeSection mode={mode} />
        </HeadingSection>
        {isStepMode && (
          <ButtonsGroup
            inlineLayoutWhen="always"
            alignment="left"
            buttonsEquisized
            buttons={[
              {
                children: "Étape précédente",
                onClick: () => onStepChange(2, []),
                iconId: "fr-icon-arrow-left-line",
                priority: "secondary",
                id: domElementIds.formEstablishment[
                  mode
                ].previousButtonFromStepAndMode({
                  currentStep,
                  mode,
                }),
              },
              {
                children: "Étape suivante",
                onClick: () => {
                  setCurrentStepSubmitted(true);
                  return onStepChange(4, [
                    "searchableBy",
                    "maxContactsPerMonth",
                    "nextAvailabilityDate",
                    "fitForDisabledWorkers",
                    "contactMode",
                    ...getConditionalFieldsToValidate(getValues("contactMode")),
                  ]);
                },
                iconId: "fr-icon-arrow-right-line",
                iconPosition: "right",
                type: "button",
                id: domElementIds.formEstablishment[
                  mode
                ].nextButtonFromStepAndMode({
                  currentStep,
                  mode,
                }),
              },
            ]}
          />
        )}
        {!isStepMode && (
          <ButtonsGroup
            inlineLayoutWhen="always"
            alignment="left"
            buttonsEquisized
            buttons={[
              {
                children: "Enregistrer les modifications",
                iconId: "fr-icon-save-line",
                priority: "primary",
                type: "submit",
                id: domElementIds.formEstablishment[mode].submitFormButton,
              },
              ...(isEstablishmentAdmin
                ? [
                    {
                      children: "Supprimer l'établissement",
                      iconId: "fr-icon-delete-bin-line",
                      priority: "secondary",
                      type: "button",
                      onClick: onClickEstablishmentDeleteButton,
                      id: domElementIds.admin.manageEstablishment
                        .submitDeleteButton,
                    } satisfies ButtonProps,
                  ]
                : []),
            ]}
          />
        )}
      </HeadingSection>
    </>
  );
};

const searchableByOptions: RadioButtonsProps["options"] = [
  {
    label: "Tout le monde (publics scolaires et non-scolaires)",
    illustration: <img src={allUsersSvg} alt="" />,
    nativeInputProps: {
      value: "all",
      defaultChecked: true,
    },
  },
  {
    label:
      "Uniquement des publics non-scolaires qui ont un projet professionnel",
    illustration: <img src={jobSeekerSvg} alt="" />,
    nativeInputProps: {
      value: "jobSeekers",
    },
  },
  {
    label: "Uniquement des publics scolaires",
    illustration: <img src={studentSvg} alt="" />,
    nativeInputProps: {
      value: "students",
    },
  },
];

const ContactModeSection = ({ mode }: { mode: Mode }) => {
  const dispatch = useDispatch();
  const { register, formState, getValues, setValue, watch } =
    useFormContext<FormEstablishmentDto>();
  const getFieldError = makeFieldError(formState);
  const establishmentAddressFromSiret = useAppSelector(
    siretSelectors.establishmentInfos,
  )?.businessAddress;
  const defaultEstablishmentAddressFromFormValues =
    getValues("businessAddresses")[0]?.rawAddress;
  const defaultEstablishmentAddress =
    mode === "create"
      ? establishmentAddressFromSiret
      : defaultEstablishmentAddressFromFormValues;

  const inPersonAddress = useAppSelector(
    makeGeocodingLocatorSelector("create-establishment-in-person-address"),
  );

  const contactMode = getValues("contactMode");
  const contactModeRegister = register("contactMode");
  const potentialBeneficiaryWelcomeAddress = getValues(
    "potentialBeneficiaryWelcomeAddress",
  );
  const allUserRights = watch("userRights");

  useEffect(() => {
    if (
      contactMode === "IN_PERSON" &&
      inPersonAddress &&
      inPersonAddress.value &&
      !potentialBeneficiaryWelcomeAddress
    ) {
      setValue("potentialBeneficiaryWelcomeAddress", inPersonAddress.value);
    }
  }, [
    contactMode,
    inPersonAddress,
    potentialBeneficiaryWelcomeAddress,
    setValue,
  ]);

  const currentUserToContact =
    allUserRights.length === 1
      ? allUserRights[0]
      : (allUserRights.find((userRight) => {
          if (contactMode === "IN_PERSON") {
            return userRight.isMainContactInPerson === true;
          }

          return userRight.isMainContactByPhone === true;
        }) ?? allUserRights[0]);

  const currentUserRight =
    mode === "create" ? allUserRights[0] : currentUserToContact;

  const currentUserRightIndex = currentUserRight
    ? allUserRights.findIndex(
        (userRight) => userRight.email === currentUserRight.email,
      )
    : 0;

  const currentUserRightFromWatched = allUserRights[currentUserRightIndex];

  const shouldShowUserToContact =
    currentUserRightFromWatched?.isMainContactByPhone === true;

  return (
    <>
      <RadioButtons
        id={domElementIds.formEstablishment[mode].contactMode}
        {...contactModeRegister}
        options={[
          {
            label: "Par e-mail",
            hintText:
              "Vous pourrez échanger et suivre vos candidatures sur un tableau de bord.",
            illustration: <img src={mailSvg} alt="" />,
            nativeInputProps: {
              ...contactModeRegister,
              value: "EMAIL",
              onChange: (event) => {
                contactModeRegister.onChange?.(event);
                const newUserRights = allUserRights.map((userRight, index) => ({
                  ...userRight,
                  isMainContactInPerson: false,
                  isMainContactByPhone: index === 0, // Default to first user for phone contact
                }));
                setValue("userRights", newUserRights);
              },
            },
          },
          {
            label: "Par téléphone",
            hintText:
              "Le candidat recevra un email avec le numéro de téléphone choisi.",
            illustration: <img src={phoneSvg} alt="" />,
            nativeInputProps: {
              ...contactModeRegister,
              value: "PHONE",
              onChange: (event) => {
                contactModeRegister.onChange?.(event);
                const defaultUserRightToContact =
                  allUserRights.find(
                    ({ isMainContactByPhone }) => isMainContactByPhone,
                  ) ??
                  allUserRights.find(({ phone }) => !!phone) ??
                  allUserRights[0];

                const newUserRights = allUserRights.map((userRight) => ({
                  ...userRight,
                  isMainContactInPerson: false,
                  isMainContactByPhone:
                    userRight.email === defaultUserRightToContact.email,
                }));

                setValue("userRights", newUserRights);
              },
            },
          },
          {
            label: "En présentiel",
            hintText:
              "Le candidat recevra un email avec votre adresse et vos coordonnées.",
            illustration: <img src={userSvg} alt="" />,
            nativeInputProps: {
              ...contactModeRegister,
              value: "IN_PERSON",
              onChange: (event) => {
                contactModeRegister.onChange?.(event);
                const newUserRights = allUserRights.map((userRight, index) => ({
                  ...userRight,
                  isMainContactInPerson: index === currentUserRightIndex,
                }));
                setValue("userRights", newUserRights);
                if (
                  !potentialBeneficiaryWelcomeAddress &&
                  defaultEstablishmentAddress
                ) {
                  dispatch(
                    geocodingSlice.actions.fetchSuggestionsRequested({
                      lookup: defaultEstablishmentAddress,
                      countryCode: "FR",
                      selectFirstSuggestion: true,
                      locator: "create-establishment-in-person-address",
                    }),
                  );
                }
              },
            },
          },
        ]}
        {...getFieldError("contactMode")}
      />
      {match(contactMode)
        .with(P.nullish, () => <>SHOULDN'T HAPPEN</>)
        .with("EMAIL", () => (
          <>
            <RadioButtons
              legend="Si vous ne répondez pas dans les 15 jours, est-ce que vous consentez à ce que le candidat vous contacte par téléphone ? *"
              id={
                domElementIds.formEstablishment[mode].businessContact
                  .isMainContactByPhone
              }
              options={[
                {
                  label: "Oui",
                  nativeInputProps: {
                    name: register(
                      `userRights.${currentUserRightIndex}.isMainContactByPhone`,
                    ).name,
                    onChange: () => {
                      const newUserRights = allUserRights.map(
                        (userRight, index) => ({
                          ...userRight,
                          isMainContactByPhone: index === currentUserRightIndex,
                        }),
                      );
                      setValue("userRights", newUserRights);
                    },
                    checked:
                      currentUserRightFromWatched?.isMainContactByPhone ===
                      true,
                  },
                },
                {
                  label: "Non",
                  nativeInputProps: {
                    name: register(
                      `userRights.${currentUserRightIndex}.isMainContactByPhone`,
                    ).name,
                    onChange: () => {
                      const newUserRights = allUserRights.map((userRight) => ({
                        ...userRight,
                        isMainContactByPhone: false,
                      }));
                      setValue("userRights", newUserRights);
                    },
                    checked:
                      currentUserRightFromWatched?.isMainContactByPhone !==
                      true,
                  },
                },
              ]}
              {...getFieldError(
                `userRights.${currentUserRightIndex}.isMainContactByPhone`,
              )}
            />
            {shouldShowUserToContact && <UserToContact mode={mode} />}
          </>
        ))
        .with("PHONE", () => <UserToContact mode={mode} />)
        .with("IN_PERSON", () => (
          <>
            <AddressAutocomplete
              label="Lieu de rendez-vous *"
              locator="create-establishment-in-person-address"
              onAddressClear={() => {}}
              initialInputValue={
                potentialBeneficiaryWelcomeAddress &&
                addressDtoToString(potentialBeneficiaryWelcomeAddress.address)
              }
              onAddressSelected={(addressAndPosition) => {
                setValue(
                  "potentialBeneficiaryWelcomeAddress",
                  addressAndPosition,
                );
              }}
              {...getFieldError("potentialBeneficiaryWelcomeAddress")}
            />
            <UserToContact mode={mode} />
          </>
        ))
        .exhaustive()}
    </>
  );
};

const UserToContact = ({ mode }: { mode: Mode }): React.ReactNode => {
  const { getValues, setValue, formState } =
    useFormContext<FormEstablishmentDto>();
  const federatedIdentity = useAppSelector(authSelectors.federatedIdentity);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const defaultUserToContact = getValues("userRights.0");
  const contactMode = getValues("contactMode");
  const establishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );
  const getFieldError = makeFieldError(formState);
  const currentUserToContact =
    establishment.userRights.length === 1
      ? establishment.userRights[0]
      : (establishment.userRights.find((userRight) => {
          if (contactMode === "IN_PERSON") {
            return userRight.isMainContactInPerson === true;
          }

          return userRight.isMainContactByPhone === true;
        }) ?? establishment.userRights[0]);
  const usersToContactOptions: SelectProps.Option[] = establishment.userRights
    .filter(onlyUserRightWithStatusAccepted)
    .filter((userRight) =>
      contactMode === "IN_PERSON" ? true : userRight.phone,
    )
    .map((userRight) => ({
      label:
        contactMode === "IN_PERSON"
          ? userRight.email
          : `${userRight.phone && toDisplayedPhoneNumber(userRight.phone)} - (${userRight.email}) `,
      value: userRight.email,
      selected: userRight.email === currentUserToContact?.email,
    }));

  return match(mode)
    .with("create", () => (
      <div>
        <strong>
          {contactMode === "IN_PERSON"
            ? "Interlocuteur sur place *"
            : "Numéro de téléphone *"}
        </strong>{" "}
        :{" "}
        {defaultUserToContact.phone &&
          toDisplayedPhoneNumber(defaultUserToContact.phone)}{" "}
        {federatedIdentity?.provider === "proConnect" &&
          currentUser &&
          `(${getFormattedFirstnameAndLastname({
            firstname: currentUser.firstName,
            lastname: currentUser.lastName,
          })})`}
      </div>
    ))
    .with(P.union("edit", "admin"), () => (
      <Select
        label={
          contactMode === "IN_PERSON"
            ? "Interlocuteur sur place *"
            : "Numéro de téléphone *"
        }
        hint={
          contactMode === "IN_PERSON"
            ? "Veuillez choisir la personne qui accueillera les candidats parmi vos utilisateurs"
            : "Veuillez choisir la personne qui répondra aux candidats parmi vos utilisateurs"
        }
        placeholder="Sélectionnez un utilisateur"
        options={usersToContactOptions}
        nativeSelectProps={{
          defaultValue: currentUserToContact?.email,
          value: currentUserToContact?.email,
          onChange: (event) => {
            const newUserToContact = establishment.userRights.find(
              (userRight) => userRight.email === event.target.value,
            );
            const contactPropToUpdate: keyof FormEstablishmentUserRight =
              contactMode === "IN_PERSON"
                ? "isMainContactInPerson"
                : "isMainContactByPhone";
            const newUserRights = establishment.userRights.map((userRight) => ({
              ...userRight,
              [contactPropToUpdate]:
                userRight.email === newUserToContact?.email,
            }));
            setValue("userRights", newUserRights);
          },
        }}
        {...getFieldError("userRights")}
      />
    ))
    .exhaustive();
};

const getConditionalFieldsToValidate = (
  contactMode: ContactMode,
): (keyof FormEstablishmentDto | DotNestedKeys<FormEstablishmentDto>)[] => {
  if (contactMode === "EMAIL") {
    return ["userRights.0.isMainContactByPhone"];
  }

  if (contactMode === "PHONE") {
    return ["userRights.0.isMainContactByPhone"];
  }

  if (contactMode === "IN_PERSON") {
    return [
      "potentialBeneficiaryWelcomeAddress",
      "userRights.0.isMainContactInPerson",
    ];
  }
  return [];
};
