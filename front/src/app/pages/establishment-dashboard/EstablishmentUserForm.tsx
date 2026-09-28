import Input from "@codegouvfr/react-dsfr/Input";
import RadioButtons from "@codegouvfr/react-dsfr/RadioButtons";
import ToggleSwitch from "@codegouvfr/react-dsfr/ToggleSwitch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import {
  type EstablishmentRole,
  establishmentsRoles,
  type FormEstablishmentUserRight,
  formEstablishmentUserRightSchema,
  type frontRoutes,
  type OmitFromExistingKeys,
  type SiretDto,
} from "shared";
import { PhoneInput } from "src/app/components/forms/commons/PhoneInput";
import { userRolesToDisplay } from "src/app/contents/userRolesToDisplay";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { mergeUserRights } from "src/app/pages/establishment-dashboard/EstablishmentUsersList";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import {
  type createFormModal,
  useFormModal,
} from "src/app/utils/createFormModal";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";

type EstablishmentUserUserFormProps = {
  alreadyExistingUserRight:
    | FormEstablishmentUserRight
    | Partial<FormEstablishmentUserRight>
    | null;
  establishmentUsersEditModal: ReturnType<typeof createFormModal>;
  selectedEstablishmentSiret?: SiretDto | undefined;
};

type EstablishmentUserFormEmptyValues = OmitFromExistingKeys<
  FormEstablishmentUserRight,
  "role"
> & { role?: EstablishmentRole };

const useEstablishmentUserFormRoute =
  makeUseTypedRoute<
    (
      | typeof frontRoutes.establishmentDashboardFormEstablishment
      | typeof frontRoutes.adminEstablishments
      | typeof frontRoutes.establishmentDashboardRegistration
    )["name"]
  >();

export const EstablishmentUserForm = ({
  alreadyExistingUserRight,
  establishmentUsersEditModal,
  selectedEstablishmentSiret,
}: EstablishmentUserUserFormProps) => {
  const formEstablishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const route = useEstablishmentUserFormRoute([
    "establishmentDashboardFormEstablishment",
    "adminEstablishments",
    "establishmentDashboardRegistration",
  ]);
  const isEstablishmentDashboardFormEstablishment =
    route.name === "establishmentDashboardFormEstablishment";
  const isEstablishmentDashboardRegistration =
    route.name === "establishmentDashboardRegistration";
  const isManageEstablishmentAdmin = route.name === "adminEstablishments";
  const dispatch = useDispatch();
  const emptyValues = {
    email: "",
    phone: "",
    job: "",
    role: undefined,
    shouldReceiveDiscussionNotifications: false,
    isMainContactByPhone: false,
    status: "ACCEPTED",
  } satisfies EstablishmentUserFormEmptyValues;
  const emptyValuesRef = useRef(emptyValues);

  const defaultValues = useMemo(
    () => ({ ...emptyValuesRef.current, ...alreadyExistingUserRight }),
    [alreadyExistingUserRight],
  );

  const methods = useForm<FormEstablishmentUserRight>({
    resolver: zodResolver(formEstablishmentUserRightSchema),
    defaultValues,
  });

  const {
    register,
    setValue,
    watch,
    reset,
    formState: { errors },
    handleSubmit,
  } = methods;

  const { formId } = useFormModal();

  const onSubmit = (data: FormEstablishmentUserRight) => {
    if (
      isEstablishmentDashboardFormEstablishment ||
      isManageEstablishmentAdmin
    ) {
      const updatedFormEstablishment = {
        ...formEstablishment,
        userRights: mergeUserRights(formEstablishment.userRights, data),
      };
      dispatch(
        establishmentSlice.actions.updateEstablishmentRequested({
          establishmentUpdate: {
            formEstablishment: updatedFormEstablishment,
            jwt: connectedUserJwt ?? "",
          },
          feedbackTopic: "establishment-dashboard-users-rights",
        }),
      );
    }
    if (
      isEstablishmentDashboardRegistration &&
      connectedUserJwt &&
      selectedEstablishmentSiret
    ) {
      dispatch(
        establishmentSlice.actions.userRegistrationOnEstablishmentRequested({
          siret: selectedEstablishmentSiret,
          userRight: data,
          feedbackTopic: "establishment-dashboard-registration",
          jwt: connectedUserJwt,
        }),
      );
    }
    establishmentUsersEditModal.close();
  };

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const values = watch();

  const formJsx = (
    <>
      {values.email && isEstablishmentDashboardFormEstablishment && (
        <p>
          Pour modifier le nom, prénom ou l'email, l'utilisateur doit passer par
          son compte ProConnect créé avec l'email :{" "}
          <strong>{values.email}</strong>
        </p>
      )}
      <form
        id={formId}
        onSubmit={(event) => {
          event.stopPropagation();
          handleSubmit(onSubmit)(event);
        }}
      >
        {!alreadyExistingUserRight?.email && (
          <Input
            label="Email *"
            nativeInputProps={{
              ...register("email"),
            }}
            {...(errors.email && {
              state: "error",
              stateRelatedMessage: errors.email.message,
            })}
          />
        )}
        <PhoneInput
          label="Téléphone *"
          inputProps={{
            label: "Téléphone *",
            nativeInputProps: {
              ...register("phone"),
              type: "phone",
            },
          }}
          onPhoneNumberChange={(phoneNumber) => {
            setValue("phone", phoneNumber);
          }}
          {...(errors.phone && {
            state: "error",
            stateRelatedMessage: errors.phone.message,
          })}
        />
        <Input
          label="Fonction *"
          nativeInputProps={{
            ...register("job"),
          }}
          {...(errors.job && {
            state: "error",
            stateRelatedMessage: errors.job.message,
          })}
        />
        <RadioButtons
          legend="Rôle"
          options={establishmentsRoles.map((role) => ({
            label: userRolesToDisplay[role].label,
            hintText: userRolesToDisplay[role].description,
            nativeInputProps: {
              checked: values.role === role,
              value: role,
              onChange: () => {
                setValue("role", role);
              },
            },
          }))}
        />

        <ToggleSwitch
          label="Recevoir les notifications pour toutes les candidatures de cet établissement"
          inputTitle="Recevoir les notifications pour toutes les candidatures de cet établissement"
          onChange={(checked) => {
            setValue("shouldReceiveDiscussionNotifications", checked);
          }}
          checked={values.shouldReceiveDiscussionNotifications}
        />
      </form>
    </>
  );
  if (isEstablishmentDashboardRegistration) {
    return <FormProvider {...methods}>{formJsx}</FormProvider>;
  }
  return formJsx;
};
