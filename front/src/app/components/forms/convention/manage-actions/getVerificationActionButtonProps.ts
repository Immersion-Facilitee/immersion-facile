import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import type {
  FrIconClassName,
  RiIconClassName,
} from "@codegouvfr/react-dsfr/fr/generatedFromCss/classNames";
import type { Dispatch, SetStateAction } from "react";
import type {
  AbsoluteUrl,
  ConventionDraftDto,
  ConventionReadDto,
  ConventionStatus,
  DeleteAssessmentRequestDto,
  EditConventionCounsellorNameRequestDto,
  EditConventionWithFinalStatusRequestDto,
  MarkPartnersErroredConventionAsHandledRequest,
  RenewConventionParams,
  Role,
  SubscriberErrorFeedback,
  TransferConventionToAgencyRequestDto,
  UpdateConventionStatusRequestDto,
  WithConventionId,
} from "shared";
import type { ModalWrapperProps } from "src/app/components/forms/convention/manage-actions/ManageActionModalWrapper";
import { linkByAction } from "src/app/components/forms/convention/manage-actions/manageActionLinks";
import { modalByAction } from "src/app/components/forms/convention/manage-actions/manageActionModals";
import { onClickByAction } from "src/app/components/forms/convention/manage-actions/manageActionOnClick";
import type { Link } from "type-route";

type BaseVerificationActionParams = {
  children: string;
  buttonId: string;
  iconId?: FrIconClassName | RiIconClassName;
  iconPosition?: "left" | "right";
  disabled?: boolean;
};

type VerificationActionModalParams = {
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
  initialStatus: ConventionStatus;
  verificationAction: VerificationActionWithModal;
  convention: ConventionReadDto;
  currentSignatoryRoles: Role[];
  onCloseValidatorModalWithoutValidatorInfo?: Dispatch<
    SetStateAction<string | null>
  >;
  broadcastErrorFeedback?: SubscriberErrorFeedback | null;
  modalTitle: string;
};

type VerificationActionLinkParams = {
  verificationAction: VerificationActionWithLink;
  convention: ConventionReadDto;
  jwt: string;
};

type VerificationActionOnClickParams = {
  verificationAction: VerificationActionWithOnClick;
  onClick: ({
    conventionDraft,
    redirectUrl,
  }: {
    conventionDraft: ConventionDraftDto;
    redirectUrl: AbsoluteUrl;
  }) => void;
  convention: ConventionReadDto;
};

export type VerificationActionParams = BaseVerificationActionParams &
  (
    | VerificationActionLinkParams
    | VerificationActionModalParams
    | VerificationActionOnClickParams
  );

const verificationActionWithOnClick = ["DUPLICATE_CONVENTION"] as const;
const isVerificationActionWithOnClick = (
  action: VerificationAction,
): action is VerificationActionWithOnClick =>
  verificationActionWithOnClick.some(
    (verificationAction) => verificationAction === action,
  );

const verificationActionsWithModal = [
  "ACCEPT_COUNSELLOR",
  "ACCEPT_VALIDATOR",
  "REJECT",
  "CANCEL",
  "DEPRECATE",
  "DELETE_ASSESSMENT",
  "TRANSFER",
  "RENEW",
  "EDIT_COUNSELLOR_NAME",
  "EDIT_CONVENTION_WITH_FINAL_STATUS",
  "BROADCAST_AGAIN",
  "MARK_AS_HANDLED",
  "FILL_ASSESSMENT_INFO",
  "SIGN",
] as const;
const isVerificationActionWithModal = (
  action: VerificationAction,
): action is VerificationActionWithModal =>
  verificationActionsWithModal.some(
    (verificationAction) => verificationAction === action,
  );

const verificationActionsWithLink = [
  "ACCESS_CONVENTION",
  "ACCESS_ASSESSMENT",
  "FILL_ASSESSMENT",
  "DECLARE_ABANDONMENT",
  "EDIT_CONVENTION",
] as const;
const isVerificationActionWithLink = (
  action: VerificationAction,
): action is VerificationActionWithLink =>
  verificationActionsWithLink.some(
    (verificationAction) => verificationAction === action,
  );

const allVerificationActions = [
  ...verificationActionsWithModal,
  ...verificationActionsWithLink,
  ...verificationActionWithOnClick,
] as const;
export type VerificationAction = (typeof allVerificationActions)[number];
export type VerificationActionWithModal =
  (typeof verificationActionsWithModal)[number];
export type VerificationActionWithLink =
  (typeof verificationActionsWithLink)[number];
export type VerificationActionWithOnClick =
  (typeof verificationActionWithOnClick)[number];

export const newStatusByVerificationAction = {
  ACCEPT_COUNSELLOR: "ACCEPTED_BY_COUNSELLOR",
  ACCEPT_VALIDATOR: "ACCEPTED_BY_VALIDATOR",
  REJECT: "REJECTED",
  CANCEL: "CANCELLED",
  DEPRECATE: "DEPRECATED",
} satisfies Record<
  Exclude<
    VerificationActionWithModal,
    | "DELETE_ASSESSMENT"
    | "TRANSFER"
    | "RENEW"
    | "EDIT_COUNSELLOR_NAME"
    | "EDIT_CONVENTION_WITH_FINAL_STATUS"
    | "BROADCAST_AGAIN"
    | "MARK_AS_HANDLED"
    | "FILL_ASSESSMENT_INFO"
    | "SIGN"
  >,
  ConventionStatus
>;

export type VerificationActionProps =
  | {
      buttonProps: ButtonProps & {
        children: string;
        linkProps: Link;
        id: string;
        iconId?: FrIconClassName | RiIconClassName;
        iconPosition?: "left" | "right";
      };
      modalWrapperProps: null;
    }
  | {
      buttonProps: ButtonProps & {
        children: string;
        id: string;
        iconId?: FrIconClassName | RiIconClassName;
        iconPosition?: "left" | "right";
      };
      modalWrapperProps: ModalWrapperProps;
    }
  | {
      buttonProps: ButtonProps & {
        children: string;
        onClick: () => void;
        id: string;
        iconId?: FrIconClassName | RiIconClassName;
        iconPosition?: "left" | "right";
      };
      modalWrapperProps: null;
    };

export const getVerificationActionProps = (
  params: VerificationActionParams,
): VerificationActionProps => {
  if (
    isVerificationActionWithLink(
      params.verificationAction as VerificationActionWithLink,
    ) &&
    "jwt" in params
  ) {
    const {
      verificationAction,
      children,
      convention,
      jwt,
      buttonId,
      iconId,
      iconPosition,
    } = params;

    const link = linkByAction(verificationAction, {
      convention,
      jwt,
    });

    const buttonProps = iconId
      ? {
          children,
          linkProps: link,
          id: buttonId,
          iconId,
          iconPosition,
        }
      : {
          children,
          linkProps: link,
          id: buttonId,
        };

    return {
      buttonProps,
      modalWrapperProps: null,
    };
  }

  if (
    isVerificationActionWithOnClick(params.verificationAction) &&
    "onClick" in params
  ) {
    const {
      verificationAction,
      children,
      onClick: onActionClick,
      convention,
      buttonId,
      iconId,
      iconPosition,
    } = params;

    const onClick = onClickByAction(verificationAction, {
      convention,
      onActionClick,
    });

    const buttonProps = iconId
      ? {
          children,
          onClick,
          id: buttonId,
          iconId,
          iconPosition,
        }
      : {
          children,
          onClick,
          id: buttonId,
        };

    return {
      buttonProps,
      modalWrapperProps: null,
    };
  }

  if (
    isVerificationActionWithModal(params.verificationAction) &&
    "onSubmit" in params
  ) {
    const {
      verificationAction,
      disabled,
      children,
      onSubmit,
      convention,
      currentSignatoryRoles,
      initialStatus,
      onCloseValidatorModalWithoutValidatorInfo,
      broadcastErrorFeedback,
      modalTitle,
      buttonId,
      iconId,
      iconPosition,
    } = params;

    const buttonProps = iconId
      ? {
          children,
          onClick: () => modalByAction(verificationAction).openModal(),
          disabled,
          id: buttonId,
          iconId,
          iconPosition,
        }
      : {
          children,
          onClick: () => modalByAction(verificationAction).openModal(),
          disabled,
          id: buttonId,
        };

    return {
      buttonProps,
      modalWrapperProps: {
        title: modalTitle,
        initialStatus: initialStatus,
        verificationAction: verificationAction,
        onSubmit,
        convention: convention,
        currentSignatoryRoles: currentSignatoryRoles,
        onCloseValidatorModalWithoutValidatorInfo:
          onCloseValidatorModalWithoutValidatorInfo,
        broadcastErrorFeedback,
        isSubmitDisabled: disabled,
      },
    };
  }

  throw new Error(`Invalid verification action: ${params.verificationAction}`);
};
