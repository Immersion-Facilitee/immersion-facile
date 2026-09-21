import Button, { type ButtonProps } from "@codegouvfr/react-dsfr/Button";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { domElementIds, type InternshipKind, type Signatory } from "shared";
import { SignConventionModalContent } from "src/app/components/forms/convention/manage-actions/modals/SignConventionModalContent";
import {
  buttonsToModalButtons,
  createFormModal,
} from "src/app/utils/createFormModal";

export const createSignModalParams = {
  isOpenedByDefault: false,
  id: "sign",
  formId: domElementIds.conventionToSign.form,
  doSubmitClosesModal: true,
};

const { Component: SignModal, open: openSignModal } = createFormModal(
  createSignModalParams,
);

type SignButtonProps = {
  disabled: boolean;
  id: string;
  onCloseSignModalWithoutSignature?: (value: boolean) => void;
  signatory: Signatory;
  internshipKind: InternshipKind;
  className?: string;
  onOpenSignModal?: () => Promise<boolean>;
  onSubmit?: () => void;
};

export const SignButton = ({
  disabled,
  id,
  onCloseSignModalWithoutSignature,
  signatory,
  internshipKind,
  className,
  onOpenSignModal,
  onSubmit,
}: SignButtonProps) => {
  const customSignModalButtons: ButtonProps[] = useMemo(
    () => [
      {
        children: "Annuler",
        type: "button",
        priority: "secondary",
        onClick: () => {
          if (onCloseSignModalWithoutSignature) {
            onCloseSignModalWithoutSignature(true);
          }
        },
      },
      {
        children: "Je termine la signature",
        id: domElementIds.conventionToSign.submitButton,
        type: "submit",
        priority: "primary",
        onClick: onSubmit,
      },
    ],
    [onCloseSignModalWithoutSignature, onSubmit],
  );
  return (
    <>
      <Button
        priority="primary"
        type="button"
        iconId="fr-icon-checkbox-circle-line"
        iconPosition="left"
        className={className}
        nativeButtonProps={{
          id,
        }}
        disabled={disabled}
        onClick={async () => {
          if (onCloseSignModalWithoutSignature) {
            onCloseSignModalWithoutSignature(false);
          }
          if (onOpenSignModal) {
            const shouldOpen = await onOpenSignModal();
            if (!shouldOpen) {
              return;
            }
          }
          openSignModal();
        }}
      >
        Signer la convention
      </Button>
      {createPortal(
        <SignModal
          title="Accepter les dispositions réglementaires et terminer la signature"
          size="large"
          concealingBackdrop={false}
          buttons={buttonsToModalButtons(customSignModalButtons)}
        >
          <SignConventionModalContent
            signatory={signatory}
            internshipKind={internshipKind}
            onCancel={() => {
              if (onCloseSignModalWithoutSignature) {
                onCloseSignModalWithoutSignature(true);
              }
            }}
          />
        </SignModal>,
        document.body,
      )}
    </>
  );
};
