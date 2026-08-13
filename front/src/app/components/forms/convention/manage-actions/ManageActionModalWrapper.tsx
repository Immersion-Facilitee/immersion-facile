import type { ModalProps } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { type Dispatch, Fragment, type SetStateAction, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ConnectedUser,
  type ConventionReadDto,
  type ConventionStatus,
  conventionStatusesWithValidator,
  type DeleteAssessmentRequestDto,
  doesStatusNeedsValidators,
  domElementIds,
  type EditConventionCounsellorNameRequestDto,
  type EditConventionWithFinalStatusRequestDto,
  isUnvalidatedConventionStatus,
  type MarkPartnersErroredConventionAsHandledRequest,
  type RenewConventionParams,
  type Role,
  type SubscriberErrorFeedback,
  type TransferConventionToAgencyRequestDto,
  type UpdateConventionStatusRequestDto,
  unvalidatedConventionStatuses,
  type WithConventionId,
} from "shared";
import {
  newStatusByVerificationAction,
  type VerificationActionWithModal,
} from "src/app/components/forms/convention/manage-actions/getVerificationActionButtonProps";
import { modalByAction } from "src/app/components/forms/convention/manage-actions/manageActionModals";
import { BroadcastAgainModalContent } from "src/app/components/forms/convention/manage-actions/modals/BroadcastAgainModalContent";
import { DeleteAssessmentModalContent } from "src/app/components/forms/convention/manage-actions/modals/DeleteAssessmentModalContent";
import { EditConventionWithFinalStatusModalContent } from "src/app/components/forms/convention/manage-actions/modals/EditConventionWithFinalStatusModalContent";
import { EditCounsellorNameModalContent } from "src/app/components/forms/convention/manage-actions/modals/EditCounsellorNameModalContent";
import { JustificationModalContent } from "src/app/components/forms/convention/manage-actions/modals/JustificationModalContent";
import { MarkConventionAsHandledModalContent } from "src/app/components/forms/convention/manage-actions/modals/MarkConventionAsHandledModalContent";
import { RenewConventionModalContent } from "src/app/components/forms/convention/manage-actions/modals/RenewConventionModalContent";
import { SignConventionModalContent } from "src/app/components/forms/convention/manage-actions/modals/SignConventionModalContent";
import { TransferModalContent } from "src/app/components/forms/convention/manage-actions/modals/TransferModalContent";
import { ValidatorModalContent } from "src/app/components/forms/convention/manage-actions/modals/ValidatorModalContent";
import { getBroadcastFeedbackDescription } from "src/app/contents/broadcast-feedback/broadcastFeedback";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { getSignatoryToSign } from "src/core-logic/domain/convention/convention.utils";
import { match, P } from "ts-pattern";

export type ModalWrapperProps = {
  title: string;
  initialStatus: ConventionStatus;
  verificationAction: VerificationActionWithModal;
  onSubmit: (
    verificationAction: VerificationActionWithModal,
    params:
      | UpdateConventionStatusRequestDto
      | DeleteAssessmentRequestDto
      | TransferConventionToAgencyRequestDto
      | RenewConventionParams
      | EditConventionCounsellorNameRequestDto
      | EditConventionWithFinalStatusRequestDto
      | WithConventionId
      | MarkPartnersErroredConventionAsHandledRequest,
  ) => void;
  convention: ConventionReadDto;
  currentSignatoryRoles: Role[];
  onCloseValidatorModalWithoutValidatorInfo?: Dispatch<
    SetStateAction<string | null>
  >;
  broadcastErrorFeedback?: SubscriberErrorFeedback | null;
  currentUser?: ConnectedUser;
  isSubmitDisabled?: boolean;
};

export const ModalWrapper = (props: ModalWrapperProps) => {
  const {
    verificationAction,
    convention,
    initialStatus,
    onSubmit,
    onCloseValidatorModalWithoutValidatorInfo,
    broadcastErrorFeedback,
    currentUser,
  } = props;
  const modalObject = modalByAction(verificationAction);
  const { createModalParams } = modalObject;
  const [
    hasSeenSyncErrorWarningBeforeValidation,
    setHasSeenSyncErrorWarningBeforeValidation,
  ] = useState(false);
  const isModalOpen = useIsModalOpen(createModalParams, {
    onConceal: () => setHasSeenSyncErrorWarningBeforeValidation(false),
  });
  const [modalProps] = useState<ModalWrapperProps>(props);
  const renewFeedback = useFeedbackTopic("convention-action-renew");
  const showTransferModal = verificationAction === "TRANSFER";
  const showEditCounsellorNameModal =
    verificationAction === "EDIT_COUNSELLOR_NAME";
  const showEditConventionWithFinalStatusModal =
    verificationAction === "EDIT_CONVENTION_WITH_FINAL_STATUS";
  const showRenewModal =
    verificationAction === "RENEW" && renewFeedback?.level !== "success";
  const showBroadcastAgainModal = verificationAction === "BROADCAST_AGAIN";
  const showMarkAsHandledModal =
    verificationAction === "MARK_AS_HANDLED" && !!currentUser;
  const showFillAssessmentInfoModal =
    verificationAction === "FILL_ASSESSMENT_INFO";
  const showSignModal = verificationAction === "SIGN";
  const showDeleteAssessmentModal = verificationAction === "DELETE_ASSESSMENT";
  const showJustificationModal =
    verificationAction !== "TRANSFER" &&
    verificationAction !== "RENEW" &&
    verificationAction !== "EDIT_COUNSELLOR_NAME" &&
    verificationAction !== "EDIT_CONVENTION_WITH_FINAL_STATUS" &&
    verificationAction !== "BROADCAST_AGAIN" &&
    verificationAction !== "MARK_AS_HANDLED" &&
    verificationAction !== "FILL_ASSESSMENT_INFO" &&
    verificationAction !== "DELETE_ASSESSMENT" &&
    verificationAction !== "SIGN" &&
    isUnvalidatedConventionStatus(
      newStatusByVerificationAction[verificationAction],
    );
  const showValidatorModal =
    verificationAction !== "TRANSFER" &&
    verificationAction !== "RENEW" &&
    verificationAction !== "EDIT_COUNSELLOR_NAME" &&
    verificationAction !== "EDIT_CONVENTION_WITH_FINAL_STATUS" &&
    verificationAction !== "BROADCAST_AGAIN" &&
    verificationAction !== "MARK_AS_HANDLED" &&
    verificationAction !== "FILL_ASSESSMENT_INFO" &&
    verificationAction !== "DELETE_ASSESSMENT" &&
    verificationAction !== "SIGN" &&
    doesStatusNeedsValidators(
      initialStatus,
      newStatusByVerificationAction[verificationAction],
    );
  const showValidatorSyncErrorWarningBeforeValidation =
    showValidatorModal &&
    verificationAction === "ACCEPT_VALIDATOR" &&
    !!broadcastErrorFeedback &&
    !hasSeenSyncErrorWarningBeforeValidation;

  if (
    !showTransferModal &&
    !showDeleteAssessmentModal &&
    !showJustificationModal &&
    !showValidatorModal &&
    !showRenewModal &&
    !showEditCounsellorNameModal &&
    !showEditConventionWithFinalStatusModal &&
    !showBroadcastAgainModal &&
    !showMarkAsHandledModal &&
    !showFillAssessmentInfoModal &&
    !showSignModal
  )
    return null;

  const { closeModal } = modalObject;

  const modalContent = (
    <Fragment
      key={`${modalObject.createModalParams.id}-${isModalOpen.toString()}`}
    >
      {match({
        showTransferModal,
        showDeleteAssessmentModal,
        showJustificationModal,
        showValidatorModal,
        showRenewModal,
        showEditCounsellorNameModal,
        showEditConventionWithFinalStatusModal,
        showBroadcastAgainModal,
        showMarkAsHandledModal,
        showFillAssessmentInfoModal,
        showSignModal,
        currentUser,
        newStatus:
          verificationAction === "TRANSFER" ||
          verificationAction === "RENEW" ||
          verificationAction === "EDIT_COUNSELLOR_NAME" ||
          verificationAction === "EDIT_CONVENTION_WITH_FINAL_STATUS" ||
          verificationAction === "BROADCAST_AGAIN" ||
          verificationAction === "MARK_AS_HANDLED" ||
          verificationAction === "FILL_ASSESSMENT_INFO" ||
          verificationAction === "DELETE_ASSESSMENT" ||
          verificationAction === "SIGN"
            ? null
            : newStatusByVerificationAction[verificationAction],
      })
        .with(
          {
            showDeleteAssessmentModal: true,
          },
          () => (
            <DeleteAssessmentModalContent
              convention={convention}
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
            />
          ),
        )
        .with(
          {
            showEditCounsellorNameModal: true,
          },
          () => (
            <EditCounsellorNameModalContent
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
              conventionId={convention.id}
            />
          ),
        )
        .with(
          {
            showEditConventionWithFinalStatusModal: true,
          },
          () => (
            <EditConventionWithFinalStatusModalContent
              convention={convention}
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
            />
          ),
        )
        .with(
          {
            showTransferModal: true,
            showJustificationModal: false,
            showValidatorModal: false,
            showRenewModal: false,
          },
          () => (
            <TransferModalContent
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
              convention={convention}
            />
          ),
        )
        .with(
          {
            showTransferModal: false,
            showJustificationModal: true,
            showValidatorModal: false,
            showRenewModal: false,
            newStatus: P.union(...unvalidatedConventionStatuses),
          },
          ({ newStatus }) => (
            <JustificationModalContent
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
              newStatus={newStatus}
              convention={convention}
            />
          ),
        )
        .with(
          {
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: true,
            showRenewModal: false,
            newStatus: P.union(...conventionStatusesWithValidator),
          },
          ({ newStatus }) => (
            <ValidatorModalContent
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
              newStatus={newStatus}
              convention={convention}
              showSyncErrorWarningStep={
                showValidatorSyncErrorWarningBeforeValidation
              }
              syncErrorMessage={
                broadcastErrorFeedback
                  ? getBroadcastFeedbackDescription(
                      broadcastErrorFeedback.message,
                    )
                  : undefined
              }
              onCloseValidatorModalWithoutValidatorInfo={
                onCloseValidatorModalWithoutValidatorInfo
              }
            />
          ),
        )
        .with(
          {
            showRenewModal: true,
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: false,
          },
          () => (
            <RenewConventionModalContent
              onSubmit={(params) => onSubmit(verificationAction, params)}
              closeModal={closeModal}
              convention={convention}
            />
          ),
        )
        .with(
          {
            showBroadcastAgainModal: true,
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: false,
            showRenewModal: false,
            showEditCounsellorNameModal: false,
            showEditConventionWithFinalStatusModal: false,
            showMarkAsHandledModal: false,
          },
          () => (
            <BroadcastAgainModalContent
              conventionId={convention.id}
              onSubmit={(params) => onSubmit(verificationAction, params)}
            />
          ),
        )
        .with(
          {
            showMarkAsHandledModal: true,
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: false,
            showRenewModal: false,
            showEditCounsellorNameModal: false,
            showEditConventionWithFinalStatusModal: false,
            showBroadcastAgainModal: false,
            currentUser: P.not(P.nullish),
          },
          ({ currentUser }) => (
            <MarkConventionAsHandledModalContent
              conventionId={convention.id}
              currentUser={currentUser}
              closeModal={closeModal}
              onSubmit={(params) => onSubmit(verificationAction, params)}
            />
          ),
        )
        .with(
          {
            showFillAssessmentInfoModal: true,
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: false,
            showRenewModal: false,
            showEditCounsellorNameModal: false,
            showEditConventionWithFinalStatusModal: false,
            showBroadcastAgainModal: false,
            showMarkAsHandledModal: false,
            showSignModal: false,
          },
          () => (
            <p>
              Seule la personne désignée comme tuteur ou tutrice dans la
              convention peut remplir le bilan d'immersion. N'hésitez pas à
              transmettre l'information au bon interlocuteur.
            </p>
          ),
        )
        .with(
          {
            showSignModal: true,
            showTransferModal: false,
            showJustificationModal: false,
            showValidatorModal: false,
            showRenewModal: false,
            showEditCounsellorNameModal: false,
            showEditConventionWithFinalStatusModal: false,
            showBroadcastAgainModal: false,
            showMarkAsHandledModal: false,
            showFillAssessmentInfoModal: false,
          },
          () => {
            const signatory = getSignatoryToSign({
              requesterRoles: props.currentSignatoryRoles,
              convention: props.convention,
            });
            if (!signatory) return null;

            return (
              <SignConventionModalContent
                signatory={signatory}
                internshipKind={props.convention.internshipKind}
                onCancel={() => {}}
                onSubmit={() => {
                  if (onSubmit) {
                    onSubmit(verificationAction, {
                      conventionId: convention.id,
                    });
                  }
                }}
              />
            );
          },
        )
        .otherwise(() => null)}
    </Fragment>
  );

  const Modal = modalObject.modal;
  const modalTitle = showValidatorSyncErrorWarningBeforeValidation
    ? "Attention : Erreur de synchronisation"
    : modalProps.title;
  const getValidatorModalButtons = (): ModalProps["buttons"] => {
    if (!showValidatorModal || verificationAction !== "ACCEPT_VALIDATOR")
      return undefined;

    if (showValidatorSyncErrorWarningBeforeValidation)
      return [
        {
          children: "Valider quand même",
          type: "button",
          priority: "secondary",
          iconId: "fr-icon-arrow-right-line",
          iconPosition: "right",
          id: domElementIds.manageConvention
            .validatorModalSyncErrorWarningConfirmButton,
          doClosesModal: false,
          onClick: () => setHasSeenSyncErrorWarningBeforeValidation(true),
        },
        {
          children: "Fermer et corriger l'erreur",
          type: "button",
          priority: "primary",
          id: domElementIds.manageConvention
            .validatorModalSyncErrorWarningCloseButton,
          onClick: closeModal,
        },
      ];

    return [
      {
        children: "Annuler",
        type: "button",
        priority: "secondary",
        id: domElementIds.manageConvention.validatorModalCancelButton,
        onClick: closeModal,
      },
      {
        children: "Valider la demande",
        type: "submit",
        priority: "primary",
        id: domElementIds.manageConvention.validatorModalSubmitButton,
      },
    ];
  };
  const validatorModalButtons = getValidatorModalButtons();

  return createPortal(
    <Modal
      {...modalProps}
      isSubmitDisabled={props.isSubmitDisabled}
      title={modalTitle}
      buttons={validatorModalButtons}
    >
      {modalContent}
    </Modal>,
    document.body,
  );
};
