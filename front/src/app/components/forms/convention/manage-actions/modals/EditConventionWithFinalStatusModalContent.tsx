import { fr } from "@codegouvfr/react-dsfr";
import Highlight from "@codegouvfr/react-dsfr/Highlight";
import Input from "@codegouvfr/react-dsfr/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import {
  type ConventionDto,
  domElementIds,
  type EditConventionWithFinalStatusFormValues,
  type EditConventionWithFinalStatusRequestDto,
  editConventionWithFinalStatusFormSchema,
  hasAgencyAllowedRolesToUpdateBeneficiaryBirthdateWithFinalStatus,
  toDateUTCString,
} from "shared";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

const pickChangedFields = (
  fields: readonly (readonly [string, unknown, unknown])[],
) =>
  Object.fromEntries(
    fields
      .filter(([, formValue, originalValue]) => formValue !== originalValue)
      .map(([key, formValue]) => [key, formValue]),
  );

const isNonEmptyObject = (value: Record<string, unknown>) =>
  Object.keys(value).length > 0;

const buildPartialEditConventionWithFinalStatusRequest = ({
  convention,
  formValues,
  canEditBeneficiary,
  canEditTutor,
}: {
  convention: ConventionDto;
  formValues: EditConventionWithFinalStatusFormValues;
  canEditBeneficiary: boolean;
  canEditTutor: boolean;
}): EditConventionWithFinalStatusRequestDto | undefined => {
  const { establishmentTutor: formTutor, beneficiary: formBeneficiary } =
    formValues;
  const originalTutor = convention.establishmentTutor;
  const originalBeneficiary = convention.signatories.beneficiary;

  const establishmentTutor =
    canEditTutor && formTutor
      ? pickChangedFields([
          ["firstname", formTutor.firstname, originalTutor.firstName],
          ["lastname", formTutor.lastname, originalTutor.lastName],
          ["job", formTutor.job, originalTutor.job],
          ["email", formTutor.email, originalTutor.email],
          ["phone", formTutor.phone, originalTutor.phone],
        ])
      : {};

  const updatedBeneficiaryBirthDateField =
    formBeneficiary?.updatedBeneficiaryBirthDate === undefined
      ? []
      : [
          [
            "updatedBeneficiaryBirthDate",
            formBeneficiary.updatedBeneficiaryBirthDate,
            originalBeneficiary.birthdate,
          ] as const,
        ];

  const beneficiaryFirstnameField =
    formBeneficiary?.firstname === undefined
      ? []
      : [
          [
            "firstname",
            formBeneficiary.firstname,
            originalBeneficiary.firstName,
          ] as const,
        ];

  const beneficiaryLastnameField =
    formBeneficiary?.lastname === undefined
      ? []
      : ([
          ["lastname", formBeneficiary.lastname, originalBeneficiary.lastName],
        ] as const);

  const beneficiary =
    canEditBeneficiary && formBeneficiary
      ? pickChangedFields([
          ...updatedBeneficiaryBirthDateField,
          ...beneficiaryFirstnameField,
          ...beneficiaryLastnameField,
        ])
      : {};

  if (!isNonEmptyObject(establishmentTutor) && !isNonEmptyObject(beneficiary))
    return undefined;

  return {
    conventionId: formValues.conventionId,
    ...(isNonEmptyObject(establishmentTutor) && {
      establishmentTutor: establishmentTutor,
    }),
    ...(isNonEmptyObject(beneficiary) && {
      beneficiary,
    }),
  };
};

export const EditConventionWithFinalStatusModalContent = ({
  convention,
  onSubmit,
  closeModal,
}: {
  convention: ConventionDto;
  onSubmit: (params: EditConventionWithFinalStatusRequestDto) => void;
  closeModal: () => void;
}) => {
  const beneficiary = convention.signatories.beneficiary;
  const establishmentTutor = convention.establishmentTutor;
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);

  const isBackofficeAdmin = currentUser?.isBackofficeAdmin ?? false;
  const canEditBeneficiaryBirthdate =
    hasAgencyAllowedRolesToUpdateBeneficiaryBirthdateWithFinalStatus({
      agencyRights: currentUser?.agencyRights ?? [],
      agencyId: convention.agencyId,
    }) || isBackofficeAdmin;
  const canEditBeneficiary = isBackofficeAdmin || canEditBeneficiaryBirthdate;
  const canEditTutor = convention.status === "ACCEPTED_BY_VALIDATOR";

  const { register, handleSubmit, formState } =
    useForm<EditConventionWithFinalStatusFormValues>({
      resolver: zodResolver(editConventionWithFinalStatusFormSchema),
      mode: "onTouched",
      defaultValues: {
        conventionId: convention.id,
        ...(canEditTutor && {
          establishmentTutor: {
            firstname: establishmentTutor.firstName,
            lastname: establishmentTutor.lastName,
            job: establishmentTutor.job,
            email: establishmentTutor.email,
            phone: establishmentTutor.phone,
          },
        }),
        ...(canEditBeneficiary && {
          beneficiary: {
            updatedBeneficiaryBirthDate: beneficiary.birthdate,
            ...(isBackofficeAdmin
              ? {
                  firstname: beneficiary.firstName,
                  lastname: beneficiary.lastName,
                }
              : {}),
          },
        }),
      },
    });

  const onFormSubmit: SubmitHandler<EditConventionWithFinalStatusFormValues> = (
    values,
  ) => {
    const request = buildPartialEditConventionWithFinalStatusRequest({
      convention,
      formValues: values,
      canEditBeneficiary,
      canEditTutor,
    });

    if (!request) return;

    onSubmit(request);
    closeModal();
  };

  const getFieldError = makeFieldError(formState);
  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      id={domElementIds.manageConvention.editConventionWithFinalStatusModalForm}
    >
      <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
        <strong>ID :</strong> {convention.id}
      </p>
      <Highlight className={fr.cx("fr-ml-0")} size="sm">
        La convention étant déjà validée, seules certaines informations peuvent
        encore être modifiées.
      </Highlight>
      {canEditBeneficiary && (
        <div className={fr.cx("fr-card", "fr-p-2w", "fr-mb-3w")}>
          <h3 className={fr.cx("fr-h6", "fr-mb-2w")}>Personne en immersion</h3>
          {canEditBeneficiaryBirthdate && (
            <Input
              label="Date de naissance"
              nativeInputProps={{
                ...register("beneficiary.updatedBeneficiaryBirthDate"),
                id: domElementIds.manageConvention
                  .editConventionWithFinalStatusModalNewDateInput,
                type: "date",
                max: toDateUTCString(new Date()),
              }}
              {...getFieldError("beneficiary.updatedBeneficiaryBirthDate")}
            />
          )}

          {isBackofficeAdmin && (
            <>
              <Input
                label="Prénom"
                nativeInputProps={{
                  ...register("beneficiary.firstname"),
                  id: domElementIds.manageConvention
                    .editConventionWithFinalStatusModalNewFirstNameInput,
                }}
                {...getFieldError("beneficiary.firstname")}
              />
              <Input
                label="Nom de famille"
                nativeInputProps={{
                  ...register("beneficiary.lastname"),
                  id: domElementIds.manageConvention
                    .editConventionWithFinalStatusModalNewLastNameInput,
                }}
                {...getFieldError("beneficiary.lastname")}
              />
            </>
          )}
        </div>
      )}

      {canEditTutor && (
        <div className={fr.cx("fr-card", "fr-p-2w")}>
          <h3 className={fr.cx("fr-h6", "fr-mb-2w")}>Tuteur de l'immersion</h3>
          <Input
            label="Prénom"
            nativeInputProps={{
              ...register("establishmentTutor.firstname"),
              id: domElementIds.manageConvention
                .editConventionWithFinalStatusModalTutorFirstNameInput,
            }}
            {...getFieldError("establishmentTutor.firstname")}
          />
          <Input
            label="Nom de famille"
            nativeInputProps={{
              ...register("establishmentTutor.lastname"),
              id: domElementIds.manageConvention
                .editConventionWithFinalStatusModalTutorLastNameInput,
            }}
            {...getFieldError("establishmentTutor.lastname")}
          />
          <Input
            label="Fonction"
            nativeInputProps={{
              ...register("establishmentTutor.job"),
              id: domElementIds.manageConvention
                .editConventionWithFinalStatusModalTutorJobInput,
            }}
            {...getFieldError("establishmentTutor.job")}
          />
          <Input
            label="Email"
            nativeInputProps={{
              ...register("establishmentTutor.email"),
              id: domElementIds.manageConvention
                .editConventionWithFinalStatusModalTutorEmailInput,
            }}
            {...getFieldError("establishmentTutor.email")}
          />
          <Input
            label="Téléphone"
            nativeInputProps={{
              ...register("establishmentTutor.phone"),
              id: domElementIds.manageConvention
                .editConventionWithFinalStatusModalTutorPhoneInput,
            }}
            {...getFieldError("establishmentTutor.phone")}
          />
        </div>
      )}
    </form>
  );
};
