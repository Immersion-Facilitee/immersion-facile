import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Input from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { zodResolver } from "@hookform/resolvers/zod";
import { pick } from "ramda";
import { type Dispatch, type SetStateAction, useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import {
  type ConventionReadDto,
  type ConventionStatusWithValidator,
  domElementIds,
  getFormattedFirstnameAndLastname,
  hasCompleteAgencyReferent,
  localization,
  type UpdateConventionStatusRequestDto,
  type WithFirstnameAndLastname,
  withFirstnameAndLastnameSchema,
} from "shared";
import { booleanSelectOptions } from "src/app/contents/forms/common/values";
import { makeFieldError } from "src/app/hooks/formContents.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useFormModal } from "src/app/utils/createFormModal";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { z } from "zod";

type ValidatorModalFormValues = WithFirstnameAndLastname & {
  isAlsoAgencyReferent?: boolean;
};

const makeValidatorModalFormSchema = (showAgencyReferentQuestion: boolean) =>
  showAgencyReferentQuestion
    ? withFirstnameAndLastnameSchema.and(
        z.object({
          isAlsoAgencyReferent: z.boolean({
            error: localization.expectedBoolean,
          }),
        }),
      )
    : withFirstnameAndLastnameSchema;

export const ValidatorModalContent = ({
  onSubmit,
  closeModal,
  newStatus,
  convention,
  showSyncErrorWarningStep = false,
  syncErrorMessage,
  onCloseValidatorModalWithoutValidatorInfo,
}: {
  onSubmit: (params: UpdateConventionStatusRequestDto) => void;
  closeModal: () => void;
  newStatus: ConventionStatusWithValidator;
  convention: ConventionReadDto;
  showSyncErrorWarningStep?: boolean;
  syncErrorMessage?: string;
  onCloseValidatorModalWithoutValidatorInfo?: Dispatch<
    SetStateAction<string | null>
  >;
}) => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const { modalOnCancelCallback, formId } = useFormModal();
  const currentUserName =
    currentUser?.firstName && currentUser?.lastName
      ? pick(["firstname", "lastname"], {
          firstname: currentUser.firstName,
          lastname: currentUser.lastName,
        })
      : undefined;
  const showAgencyReferentQuestion = !hasCompleteAgencyReferent(
    convention.agencyReferent,
  );

  const { register, handleSubmit, formState, watch, setValue } =
    useForm<ValidatorModalFormValues>({
      resolver: zodResolver(
        makeValidatorModalFormSchema(showAgencyReferentQuestion),
      ),
      mode: "onTouched",
      defaultValues: currentUserName,
    });
  const onFormSubmit: SubmitHandler<ValidatorModalFormValues> = ({
    firstname,
    lastname,
    isAlsoAgencyReferent,
  }) => {
    onSubmit({
      status: newStatus,
      conventionId: convention.id,
      firstname,
      lastname,
      ...(showAgencyReferentQuestion ? { isAlsoAgencyReferent } : {}),
    });
    closeModal();
  };
  const getFieldError = makeFieldError(formState);
  const isAlsoAgencyReferent = watch("isAlsoAgencyReferent");

  useEffect(() => {
    if (showSyncErrorWarningStep) return;
    return modalOnCancelCallback(() => {
      if (onCloseValidatorModalWithoutValidatorInfo) {
        onCloseValidatorModalWithoutValidatorInfo(
          warningMessagesByConventionStatus[newStatus],
        );
      }
    });
  }, [
    modalOnCancelCallback,
    onCloseValidatorModalWithoutValidatorInfo,
    newStatus,
    showSyncErrorWarningStep,
  ]);

  if (showSyncErrorWarningStep)
    return (
      <>
        <p>
          Vous êtes sur le point de valider une convention qui présente une
          erreur de synchronisation avec{" "}
          {convention.agencyKind === "mission-locale" ||
          convention.agencyRefersTo?.kind === "mission-locale"
            ? "i-Milo"
            : "France Travail"}
          .
        </p>
        <p>
          <strong>Motif de l’erreur :</strong>{" "}
          {syncErrorMessage ?? "Non renseigné"}
        </p>
        <p>
          <strong>Conséquence :</strong> Une fois validée, la convention ne
          pourra plus être modifiée et les données ne remonteront pas dans votre
          applicatif.
        </p>
        <p>
          <strong>Corriger l’erreur :</strong> Fermez cette fenêtre et consultez
          l'encart “Détails des solutions possibles” affiché sur votre page.
        </p>
      </>
    );

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} id={formId}>
      {convention.isEstablishmentBanned && (
        <Alert
          severity="warning"
          small
          closable
          description={`L’entreprise liée à cette convention a été bannie d’Immersion Facilitée suite à des signalements. Nous vous recommandons de ne pas ${newStatus === "ACCEPTED_BY_VALIDATOR" ? "valider" : "pré-valider"} cette convention.`}
          className={fr.cx("fr-mb-3w")}
        />
      )}
      <p>
        Veuillez saisir votre prénom et votre nom. En{" "}
        {newStatus === "ACCEPTED_BY_VALIDATOR" ? "validant" : "pré-validant"},
        vous attestez que ces informations sont exactes : elles apparaîtront sur
        la convention finale au format PDF.
      </p>
      <Input
        label={"Prénom *"}
        nativeInputProps={{
          ...register("firstname"),
          required: true,
          id: domElementIds.manageConvention.validatorModalFirstNameInput,
        }}
        {...getFieldError("firstname")}
      />
      <Input
        label={"Nom *"}
        nativeInputProps={{
          ...register("lastname"),
          required: true,
          id: domElementIds.manageConvention.validatorModalLastNameInput,
        }}
        {...getFieldError("lastname")}
      />
      {showAgencyReferentQuestion && (
        <RadioButtons
          legend={`Est-elle également le conseiller pour le suivi de ${getFormattedFirstnameAndLastname(
            {
              firstname: convention.signatories.beneficiary.firstName,
              lastname: convention.signatories.beneficiary.lastName,
            },
          )} ? *`}
          name="isAlsoAgencyReferent"
          id={domElementIds.manageConvention.validatorModalIsAlsoAgencyReferent}
          options={booleanSelectOptions.map((option) => ({
            ...option,
            nativeInputProps: {
              ...option.nativeInputProps,
              checked: !!option.nativeInputProps.value === isAlsoAgencyReferent,
              onChange: () => {
                setValue(
                  "isAlsoAgencyReferent",
                  option.nativeInputProps.value === 1,
                  { shouldValidate: true },
                );
              },
            },
          }))}
          {...getFieldError("isAlsoAgencyReferent")}
        />
      )}
    </form>
  );
};

const warningMessagesByConventionStatus: Record<
  ConventionStatusWithValidator,
  string
> = {
  ACCEPTED_BY_COUNSELLOR:
    'Vous n\'avez pas pré-validé la demande. Pour le faire, cliquez sur "Pré-valider la demande" puis sur "Terminer"',
  ACCEPTED_BY_VALIDATOR:
    'Vous n\'avez pas marqué la validation de la demande. Pour le faire, cliquez sur "Valider la demande" puis sur "Terminer la validation"',
};
