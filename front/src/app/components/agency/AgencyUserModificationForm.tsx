import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  domElementIds,
  keys,
  toLowerCaseWithoutDiacritics,
  type UserParamsForAgency,
  userParamsForAgencySchema,
} from "shared";
import type { AgencyOverviewRouteName } from "src/app/components/forms/agency/AgencyOverview";
import { EmailValidationInput } from "src/app/components/forms/commons/EmailValidationInput";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { match, P } from "ts-pattern";
import { agencyRolesToDisplay } from "../../contents/userRolesToDisplay";

export const AgencyUserModificationForm = ({
  agencyUser,
  closeModal,
  agencyHasRefersTo,
  isEmailDisabled,
  areRolesDisabled,
  onSubmit,
  routeName,
  hasCounsellorRoles,
  modalId,
  isFTAgency,
}: {
  agencyUser: UserParamsForAgency & { isIcUser: boolean };
  closeModal: () => void;
  agencyHasRefersTo: boolean;
  isEmailDisabled?: boolean;
  areRolesDisabled?: boolean;
  onSubmit: (userParamsForAgency: UserParamsForAgency) => void;
  routeName: AgencyOverviewRouteName;
  hasCounsellorRoles: boolean;
  modalId: string;
  isFTAgency: boolean;
}) => {
  const onCloseModal = () => {
    reset(agencyUser);
    setDisplayFirstCounsellorInformation(false);
  };

  const [
    displayFirstCounsellorInformation,
    setDisplayFirstCounsellorInformation,
  ] = useState<boolean>(false);

  const methods = useForm<UserParamsForAgency>({
    resolver: zodResolver(userParamsForAgencySchema),
    mode: "onTouched",
    defaultValues: agencyUser,
  });

  const { watch, register, setValue, handleSubmit, formState, reset } = methods;

  const values = watch();

  const getFieldError = makeFieldError(formState);

  const onValidSubmit = () => {
    const validatedUserRoles = values.roles.filter(
      (role) => role !== "to-review",
    );
    onSubmit({
      ...values,
      roles: validatedUserRoles,
    });
    closeModal();
  };

  const availableRoles = keys(agencyRolesToDisplay).filter(
    (role) =>
      role !== "to-review" && (isFTAgency ? role !== "counsellor" : true),
  );
  const checkboxOptions = availableRoles.map((availableRole) => ({
    label: agencyRolesToDisplay[availableRole].label,
    nativeInputProps: {
      name: register("roles").name,
      checked: values.roles.includes(availableRole),
      onChange: () => {
        const rolesToSet = values.roles.includes(availableRole)
          ? values.roles.filter((role) => role !== availableRole)
          : [...values.roles, availableRole];
        setValue("roles", rolesToSet, {
          shouldValidate: true,
        });
        setDisplayFirstCounsellorInformation(
          !hasCounsellorRoles && rolesToSet.includes("counsellor"),
        );
      },
    },
    hintText: agencyRolesToDisplay[availableRole].description,
  }));

  const checkboxOptionsWithFilter = () => {
    if (agencyHasRefersTo)
      return checkboxOptions.filter((option) => option.label !== "Validateur");
    return checkboxOptions;
  };

  const [invalidEmailMessage, setInvalidEmailMessage] =
    useState<ReactNode | null>(null);

  useIsModalOpen(
    {
      id: modalId,
      isOpenedByDefault: false,
    },
    {
      onConceal: onCloseModal,
      onDisclose: onCloseModal,
    },
  );

  if (!agencyUser) return null;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onValidSubmit)}>
        <EmailValidationInput
          label="Email"
          nativeInputProps={{
            ...register("email", {
              setValueAs: (value) => toLowerCaseWithoutDiacritics(value),
            }),
            id: agencyUserModificationFormIds(routeName).editAgencyUserEmail,
            onBlur: (event) => {
              setValue(
                "email",
                toLowerCaseWithoutDiacritics(event.currentTarget.value),
              );
            },
          }}
          {...getFieldError("email")}
          disabled={isEmailDisabled ?? agencyUser.isIcUser}
          onEmailValidationFeedback={({ state, stateRelatedMessage }) => {
            setInvalidEmailMessage(
              state === "error" ? stateRelatedMessage : null,
            );
          }}
        />

        <Checkbox
          id={
            agencyUserModificationFormIds(routeName)
              .editAgencyManageUserCheckbox
          }
          legend="Rôles :"
          {...getFieldError("roles")}
          options={checkboxOptionsWithFilter()}
          disabled={!!areRolesDisabled}
        />

        <ToggleSwitch
          id={
            agencyUserModificationFormIds(routeName)
              .editAgencyUserIsNotifiedByEmail
          }
          label="Recevoir les notifications pour toutes les conventions de cette structure"
          checked={values.isNotifiedByEmail}
          onChange={() =>
            setValue("isNotifiedByEmail", !values.isNotifiedByEmail, {
              shouldValidate: true,
            })
          }
        />

        {invalidEmailMessage}
        {displayFirstCounsellorInformation && (
          <Alert
            className={fr.cx("fr-my-4w")}
            severity="warning"
            title="Modification du processus de validation"
            description={
              <>
                <p>
                  L’ajout d’un premier pré-validateur active un processus de
                  validation en deux étapes.
                </p>
                <p>
                  Cette configuration est adaptée aux structures où un premier
                  niveau vérifie les conventions, puis un deuxième niveau
                  s’occupe de la validation administrative.
                </p>
              </>
            }
          />
        )}
        <Button
          id={
            agencyUserModificationFormIds(routeName)
              .editAgencyUserRoleSubmitButton
          }
          className={fr.cx("fr-mt-2w")}
          disabled={invalidEmailMessage != null}
        >
          Valider
        </Button>
      </form>
    </FormProvider>
  );
};

const agencyUserModificationFormIds = (routeName: AgencyOverviewRouteName) =>
  match(routeName)
    .with(
      P.union("adminAgencies", "adminAgencyDetail"),
      () => domElementIds.admin.agencyTab,
    )
    .with(
      "agencyDashboardAgencyDetails",
      () => domElementIds.agencyDashboard.agencyDetails,
    )
    .with("myAccount", () => domElementIds.myAccount)
    .exhaustive();
