import { createModal, type ModalProps } from "@codegouvfr/react-dsfr/Modal";
import type { ComponentType } from "react";
import { domElementIds, type UnvalidatedConventionStatus } from "shared";
import type { VerificationActionWithModal } from "src/app/components/forms/convention/manage-actions/getVerificationActionButtonProps";
import {
  createFormModal,
  type FormModalProps,
} from "src/app/utils/createFormModal";

const confirmByStatus: Record<UnvalidatedConventionStatus, string> = {
  REJECTED: "Confirmer le refus",
  CANCELLED: "Confirmer l'annulation",
  DEPRECATED: "Confirmer que la demande est obsolète",
};

const submitButtonIdByStatus: Record<UnvalidatedConventionStatus, string> = {
  REJECTED: domElementIds.manageConvention.rejectedModalSubmitButton,
  CANCELLED: domElementIds.manageConvention.cancelModalSubmitButton,
  DEPRECATED: domElementIds.manageConvention.deprecatedModalSubmitButton,
};

const cancelButtonIdByStatus: Record<UnvalidatedConventionStatus, string> = {
  REJECTED: domElementIds.manageConvention.rejectedModalCancelButton,
  CANCELLED: domElementIds.manageConvention.cancelModalCancelButton,
  DEPRECATED: domElementIds.manageConvention.deprecatedModalCancelButton,
};

const createRejectModalParams = {
  id: domElementIds.manageConvention.rejectedModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.rejectedModalForm,
  submitButton: {
    id: submitButtonIdByStatus.REJECTED,
    children: confirmByStatus.REJECTED,
  },
  cancelButton: {
    id: cancelButtonIdByStatus.REJECTED,
  },
  doSubmitClosesModal: false,
};
const {
  Component: RejectModal,
  open: openRejectModal,
  close: closeRejectModal,
} = createFormModal(createRejectModalParams);

const createCancelModalParams = {
  id: domElementIds.manageConvention.cancelModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.cancelModalForm,
  submitButton: {
    id: submitButtonIdByStatus.CANCELLED,
    children: confirmByStatus.CANCELLED,
  },
  cancelButton: {
    id: cancelButtonIdByStatus.CANCELLED,
  },
  doSubmitClosesModal: false,
};
const {
  Component: CancelModal,
  open: openCancelModal,
  close: closeCancelModal,
} = createFormModal(createCancelModalParams);

const createDeleteAssessmentModalParams = {
  id: domElementIds.manageConvention.deleteAssessmentModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.deleteAssessmentModalForm,
  submitButton: {
    id: domElementIds.manageConvention.deleteAssessmentModalSubmitButton,
    children: "Supprimer le bilan",
  },
  cancelButton: {
    id: domElementIds.manageConvention.deleteAssessmentModalCancelButton,
    children: "Annuler",
  },
  doSubmitClosesModal: false,
};
const {
  Component: DeleteAssessmentModal,
  open: openDeleteAssessmentModal,
  close: closeDeleteAssessmentModal,
} = createFormModal(createDeleteAssessmentModalParams);

const createDeprecatedModalParams = {
  id: domElementIds.manageConvention.deprecatedModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.deprecateModalForm,
  submitButton: {
    id: submitButtonIdByStatus.DEPRECATED,
    children: confirmByStatus.DEPRECATED,
  },
  cancelButton: {
    id: cancelButtonIdByStatus.DEPRECATED,
  },
  doSubmitClosesModal: false,
};
const {
  Component: DeprecateModal,
  open: openDeprecateModal,
  close: closeDeprecateModal,
} = createFormModal(createDeprecatedModalParams);

const createCounsellorModalParams = {
  id: domElementIds.manageConvention.counsellorModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.counsellorModalForm,
  submitButton: {
    id: domElementIds.manageConvention.counsellorModalSubmitButton,
    children: "Pré-valider la demande",
  },
};
const {
  Component: CounsellorModal,
  open: openCounsellorModal,
  close: closeCounsellorModal,
} = createFormModal(createCounsellorModalParams);

const createValidatorModalParams = {
  id: domElementIds.manageConvention.validatorModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.validatorModalForm,
};
const {
  Component: ValidatorModal,
  open: openValidatorModal,
  close: closeValidatorModal,
} = createFormModal(createValidatorModalParams);

const createTransferConventionModalParams = {
  id: domElementIds.manageConvention.transferConventionModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.transferConventionModalForm,
  doSubmitClosesModal: false,
  submitButton: {
    id: domElementIds.manageConvention.transferToAgencySubmitButton,
  },
  cancelButton: {
    id: domElementIds.manageConvention.transferToAgencyCancelButton,
  },
};
const {
  Component: TransferConventionModal,
  open: openTransferConventionModal,
  close: closeTransferConventionModal,
} = createFormModal(createTransferConventionModalParams);

const createEditCounsellorNameModalParams = {
  id: domElementIds.manageConvention.editCounsellorNameModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.editCounsellorNameModalForm,
  doSubmitClosesModal: false,
  submitButton: {
    id: domElementIds.manageConvention.editCounsellorNameModalSubmitButton,
  },
};
const {
  Component: EditCounsellorNameModal,
  open: openEditCounsellorNameModal,
  close: closeEditCounsellorNameModal,
} = createFormModal(createEditCounsellorNameModalParams);

const createEditConventionWithFinalStatusModalParams = {
  id: domElementIds.manageConvention.editConventionWithFinalStatusModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.editConventionWithFinalStatusModalForm,
  doSubmitClosesModal: false,
  submitButton: {
    id: domElementIds.manageConvention
      .editConventionWithFinalStatusModalSubmitButton,
    children: "Sauvegarder les modifications",
  },
  cancelButton: {
    id: domElementIds.manageConvention
      .editConventionWithFinalStatusModalCancelButton,
    children: "Annuler",
  },
};
const {
  Component: EditConventionWithFinalStatusModal,
  open: openEditConventionWithFinalStatusModal,
  close: closeEditConventionWithFinalStatusModal,
} = createFormModal(createEditConventionWithFinalStatusModalParams);

const createRenewConventionModalParams = {
  id: domElementIds.manageConvention.renewModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.renewModalForm,
  doSubmitClosesModal: false,
  submitButton: {
    id: domElementIds.manageConvention.submitRenewModalButton,
    children: "Renouveler la convention",
  },
  cancelButton: {
    id: domElementIds.manageConvention.renewModalCancelButton,
    children: "Annuler et revenir en arrière",
  },
};

const {
  Component: RenewConventionModal,
  open: openRenewConventionModal,
  close: closeRenewConventionModal,
} = createFormModal(createRenewConventionModalParams);

const createBroadcastAgainModalParams = {
  formId: domElementIds.manageConvention.broadcastAgainModalForm,
  id: domElementIds.manageConvention.broadcastAgainModal,
  isOpenedByDefault: false,
  submitButton: { children: "Rediffuser" },
  doSubmitClosesModal: false,
};
const {
  Component: BroadcastAgainModal,
  open: openBroadcastAgainModal,
  close: closeBroadcastAgainModal,
} = createFormModal(createBroadcastAgainModalParams);

const createMarkAsHandledModalParams = {
  id: domElementIds.manageConvention.erroredConventionHandledModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.erroredConventionHandledModal,
};
const {
  Component: MarkAsHandledModal,
  open: openMarkAsHandledModal,
  close: closeMarkAsHandledModal,
} = createFormModal(createMarkAsHandledModalParams);

const createFillAssessmentInfoModalParams = {
  id: domElementIds.manageConvention.fillAssessmentInfoModal,
  isOpenedByDefault: false,
};
const {
  Component: FillAssessmentInfoModal,
  open: openFillAssessmentInfoModal,
  close: closeFillAssessmentInfoModal,
} = createModal(createFillAssessmentInfoModalParams);

const createSignModalParams = {
  id: domElementIds.manageConvention.signModal,
  isOpenedByDefault: false,
  formId: domElementIds.manageConvention.signModalForm,
  submitButton: {
    id: domElementIds.manageConvention.submitSignModalButton,
  },
};
const {
  Component: SignModal,
  open: openSignModal,
  close: closeSignModal,
} = createFormModal(createSignModalParams);

type ModalAction = {
  modal: ComponentType<FormModalProps> | ComponentType<ModalProps>;
  openModal: () => void;
  closeModal: () => void;
  createModalParams: Parameters<typeof createModal>[0];
  buttons?: ModalProps["buttons"];
};

export const modalByAction = (
  verificationAction: VerificationActionWithModal,
): ModalAction => {
  const modals: Record<VerificationActionWithModal, ModalAction> = {
    REJECT: {
      modal: RejectModal,
      openModal: openRejectModal,
      closeModal: closeRejectModal,
      createModalParams: createRejectModalParams,
    },
    CANCEL: {
      modal: CancelModal,
      openModal: openCancelModal,
      closeModal: closeCancelModal,
      createModalParams: createCancelModalParams,
    },
    DEPRECATE: {
      modal: DeprecateModal,
      openModal: openDeprecateModal,
      closeModal: closeDeprecateModal,
      createModalParams: createDeprecatedModalParams,
    },
    DELETE_ASSESSMENT: {
      modal: DeleteAssessmentModal,
      openModal: openDeleteAssessmentModal,
      closeModal: closeDeleteAssessmentModal,
      createModalParams: createDeleteAssessmentModalParams,
    },
    ACCEPT_COUNSELLOR: {
      modal: CounsellorModal,
      openModal: openCounsellorModal,
      closeModal: closeCounsellorModal,
      createModalParams: createCounsellorModalParams,
    },
    ACCEPT_VALIDATOR: {
      modal: ValidatorModal,
      openModal: openValidatorModal,
      closeModal: closeValidatorModal,
      createModalParams: createValidatorModalParams,
    },
    TRANSFER: {
      modal: TransferConventionModal,
      openModal: openTransferConventionModal,
      closeModal: closeTransferConventionModal,
      createModalParams: createTransferConventionModalParams,
    },
    RENEW: {
      modal: RenewConventionModal,
      openModal: openRenewConventionModal,
      closeModal: closeRenewConventionModal,
      createModalParams: createRenewConventionModalParams,
    },
    EDIT_COUNSELLOR_NAME: {
      modal: EditCounsellorNameModal,
      openModal: openEditCounsellorNameModal,
      closeModal: closeEditCounsellorNameModal,
      createModalParams: createEditCounsellorNameModalParams,
    },
    EDIT_CONVENTION_WITH_FINAL_STATUS: {
      modal: EditConventionWithFinalStatusModal,
      openModal: openEditConventionWithFinalStatusModal,
      closeModal: closeEditConventionWithFinalStatusModal,
      createModalParams: createEditConventionWithFinalStatusModalParams,
    },
    BROADCAST_AGAIN: {
      modal: BroadcastAgainModal,
      openModal: openBroadcastAgainModal,
      closeModal: closeBroadcastAgainModal,
      createModalParams: createBroadcastAgainModalParams,
    },
    MARK_AS_HANDLED: {
      modal: MarkAsHandledModal,
      openModal: openMarkAsHandledModal,
      closeModal: closeMarkAsHandledModal,
      createModalParams: createMarkAsHandledModalParams,
    },
    FILL_ASSESSMENT_INFO: {
      modal: FillAssessmentInfoModal,
      openModal: openFillAssessmentInfoModal,
      closeModal: closeFillAssessmentInfoModal,
      createModalParams: createFillAssessmentInfoModalParams,
      buttons: [
        {
          children: "J'ai compris",
          type: "button",
          priority: "primary",
          onClick: closeFillAssessmentInfoModal,
        },
      ],
    },
    SIGN: {
      modal: SignModal,
      openModal: openSignModal,
      closeModal: closeSignModal,
      createModalParams: createSignModalParams,
    },
  };
  return modals[verificationAction];
};
