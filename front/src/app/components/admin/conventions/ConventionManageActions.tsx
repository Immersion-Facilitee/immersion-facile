import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { mapObjIndexed } from "ramda";
import { type ReactNode, useState } from "react";
import { useBreakpoint } from "react-design-system/src/helpers/layout";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type ConnectedUserJwt,
  type ConventionJwt,
  type ConventionReadDto,
  type DeleteAssessmentRequestDto,
  domElementIds,
  type EditConventionCounsellorNameRequestDto,
  type EditConventionWithFinalStatusRequestDto,
  type ExcludeFromExisting,
  type MarkPartnersErroredConventionAsHandledRequest,
  type RenewConventionParams,
  type Role,
  type TransferConventionToAgencyRequestDto,
  type UpdateConventionStatusRequestDto,
  type WithConventionId,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { getButtonConfigBySubStatus } from "src/app/components/forms/convention/manage-actions/getButtonConfigBySubStatus";
import type { VerificationAction } from "src/app/components/forms/convention/manage-actions/getVerificationActionButtonProps";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { isAssessmentToBeSignedByBeneficiary } from "src/app/utils/assessment.utils";
import { getConventionSubStatus } from "src/app/utils/conventionSubStatus";
import { apiConsumerSelectors } from "src/core-logic/domain/apiConsumer/apiConsumer.selector";
import { assessmentSlice } from "src/core-logic/domain/assessment/assessment.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionActionSelectors } from "src/core-logic/domain/convention/convention-action/conventionAction.selectors";
import { conventionActionSlice } from "src/core-logic/domain/convention/convention-action/conventionAction.slice";
import { editConventionWithFinalStatusSlice } from "src/core-logic/domain/convention/edit-convention-with-final-status/editConventionWithFinalStatus.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import type { Feedback as FeedbackType } from "src/core-logic/domain/feedback/feedback.slice";
import { partnersErroredConventionSelectors } from "src/core-logic/domain/partnersErroredConvention/partnersErroredConvention.selectors";
import { partnersErroredConventionSlice } from "src/core-logic/domain/partnersErroredConvention/partnersErroredConvention.slice";
import { renderButtonsBySubStatus } from "./renderButtonsBySubStatus";

export type JwtKindProps =
  | {
      jwt: ConnectedUserJwt;
      kind: "connected user backoffice";
    }
  | {
      jwt: ConventionJwt;
      kind: "convention";
    }
  | {
      jwt: ConnectedUserJwt;
      kind: "connected user";
    };

type ConventionManageActionsProps = {
  jwtParams: JwtKindProps;
  convention: ConventionReadDto;
  roles: Role[];
};

const mobileManageConventionModal = createModal({
  id: "mobile-manage-convention-modal",
  isOpenedByDefault: false,
});

const getDisabledButtons = (
  params: Partial<
    Record<VerificationAction, FeedbackType | boolean | undefined>
  >,
): Partial<Record<VerificationAction, boolean>> =>
  mapObjIndexed(
    (feedback) =>
      typeof feedback === "boolean" ? feedback : feedback !== undefined,
    params,
  );

export const ConventionManageActions = ({
  convention,
  roles,
  jwtParams,
}: ConventionManageActionsProps): JSX.Element => {
  const dispatch = useDispatch();
  const isConventionActionLoading = useAppSelector(
    conventionActionSelectors.isLoading,
  );
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const broadcastErrorFeedback = useAppSelector(
    partnersErroredConventionSelectors.lastBroadcastFeedback,
  )?.subscriberErrorFeedback;

  const feedbacks = useAppSelector(feedbacksSelectors.feedbacks);
  const consumerNames = useAppSelector(apiConsumerSelectors.apiConsumerNames);
  const isLoadingApiConsumer = useAppSelector(apiConsumerSelectors.isLoading);
  const isBroadcasting = useAppSelector(
    conventionActionSelectors.isBroadcasting,
  );
  const hasBroadcastErrorFeedback =
    feedbacks["broadcast-convention-again"]?.level === "error";

  const isBroadcastAgainDisabled =
    isBroadcasting ||
    hasBroadcastErrorFeedback ||
    isLoadingApiConsumer ||
    consumerNames.length === 0;

  const disabledButtons: Partial<Record<VerificationAction, boolean>> =
    getDisabledButtons({
      ACCEPT_VALIDATOR: useFeedbackTopic(
        "convention-action-accept-by-validator",
      ),
      ACCEPT_COUNSELLOR: useFeedbackTopic(
        "convention-action-accept-by-counsellor",
      ),
      REJECT: useFeedbackTopic("convention-action-reject"),
      DEPRECATE: useFeedbackTopic("convention-action-deprecate"),
      CANCEL: useFeedbackTopic("convention-action-cancel"),
      RENEW: useFeedbackTopic("convention-action-renew"),
      EDIT_COUNSELLOR_NAME: useFeedbackTopic(
        "convention-action-edit-counsellor-name",
      ),
      TRANSFER: useFeedbackTopic("transfer-convention-to-agency"),
      BROADCAST_AGAIN: isBroadcastAgainDisabled,
      SIGN: useFeedbackTopic("convention-action-sign"),
    });

  const [validatorWarningMessage, setValidatorWarningMessage] = useState<
    string | null
  >(null);

  const createOnSubmitWithFeedbackKind = (
    verificationAction: VerificationAction,
    params:
      | UpdateConventionStatusRequestDto
      | DeleteAssessmentRequestDto
      | TransferConventionToAgencyRequestDto
      | RenewConventionParams
      | EditConventionCounsellorNameRequestDto
      | EditConventionWithFinalStatusRequestDto
      | WithConventionId
      | MarkPartnersErroredConventionAsHandledRequest,
  ) => {
    if (isConventionActionLoading) return;

    if (verificationAction === "EDIT_CONVENTION_WITH_FINAL_STATUS") {
      if ("beneficiary" in params && jwtParams.kind === "convention") return;
      dispatch(
        editConventionWithFinalStatusSlice.actions.editConventionWithFinalStatusRequested(
          {
            ...(params as EditConventionWithFinalStatusRequestDto),
            jwt: jwtParams.jwt,
            feedbackTopic: "edit-convention-with-final-status",
          },
        ),
      );
      return;
    }

    if (verificationAction === "BROADCAST_AGAIN" && "conventionId" in params) {
      dispatch(
        conventionActionSlice.actions.broadcastConventionToPartnerRequested({
          conventionId: params.conventionId,
          feedbackTopic: "broadcast-convention-again",
        }),
      );
      return;
    }

    if (verificationAction === "MARK_AS_HANDLED" && "conventionId" in params) {
      dispatch(
        partnersErroredConventionSlice.actions.markAsHandledRequested({
          jwt: jwtParams.jwt,
          markAsHandledParams: { conventionId: params.conventionId },
          feedbackTopic: "partner-conventions",
        }),
      );
      return;
    }

    if (verificationAction === "SIGN" && "conventionId" in params) {
      dispatch(
        conventionActionSlice.actions.signConventionRequested({
          jwt: jwtParams.jwt,
          conventionId: params.conventionId,
          feedbackTopic: "convention-action-sign",
        }),
      );
      return;
    }

    if (
      verificationAction === "DELETE_ASSESSMENT" &&
      "deleteAssessmentJustification" in params
    ) {
      dispatch(
        assessmentSlice.actions.deleteAssessmentRequested({
          params: {
            conventionId: params.conventionId,
            deleteAssessmentJustification: params.deleteAssessmentJustification,
          },
          jwt: jwtParams.jwt,
          feedbackTopic: "delete-assessment",
        }),
      );
      return;
    }

    if ("agencyId" in params) {
      dispatch(
        conventionActionSlice.actions.transferConventionToAgencyRequested({
          transferConventionToAgencyParams: {
            agencyId: params.agencyId,
            conventionId: params.conventionId,
            justification: params.justification,
          },
          jwt: jwtParams.jwt,
          feedbackTopic: "transfer-convention-to-agency",
        }),
      );
      return;
    }

    if (
      "firstname" in params &&
      "lastname" in params &&
      !("status" in params)
    ) {
      dispatch(
        conventionActionSlice.actions.editCounsellorNameRequested({
          editCounsellorNameParams: params,
          jwt: jwtParams.jwt,
          feedbackTopic: "convention-action-edit-counsellor-name",
        }),
      );
      return;
    }

    if ("schedule" in params) {
      dispatch(
        conventionActionSlice.actions.renewConventionRequested({
          params,
          jwt: jwtParams.jwt,
          feedbackTopic: "convention-action-renew",
        }),
      );
      return;
    }

    if ("status" in params) {
      if (params.status === "ACCEPTED_BY_COUNSELLOR") {
        dispatch(
          conventionActionSlice.actions.acceptByCounsellorRequested({
            jwt: jwtParams.jwt,
            feedbackTopic: "convention-action-accept-by-counsellor",
            updateStatusParams: params,
          }),
        );
      }
      if (params.status === "ACCEPTED_BY_VALIDATOR") {
        dispatch(
          conventionActionSlice.actions.acceptByValidatorRequested({
            jwt: jwtParams.jwt,
            feedbackTopic: "convention-action-accept-by-validator",
            updateStatusParams: params,
          }),
        );
      }
      if (params.status === "REJECTED") {
        dispatch(
          conventionActionSlice.actions.rejectConventionRequested({
            jwt: jwtParams.jwt,
            feedbackTopic: "convention-action-reject",
            updateStatusParams: params,
          }),
        );
      }
      if (params.status === "DEPRECATED") {
        dispatch(
          conventionActionSlice.actions.deprecateConventionRequested({
            jwt: jwtParams.jwt,
            feedbackTopic: "convention-action-deprecate",
            updateStatusParams: params,
          }),
        );
      }
      if (params.status === "CANCELLED") {
        dispatch(
          conventionActionSlice.actions.cancelConventionRequested({
            jwt: jwtParams.jwt,
            feedbackTopic: "convention-action-cancel",
            updateStatusParams: params,
          }),
        );
      }
    }
  };

  const requesterRoles = roles.filter(
    (role): role is ExcludeFromExisting<Role, "agency-admin"> =>
      role !== "agency-admin",
  );

  const hasBroadcastError = !!broadcastErrorFeedback;
  const subStatus = getConventionSubStatus(convention, hasBroadcastError);

  const buttonConfig = getButtonConfigBySubStatus({
    convention,
    jwt: jwtParams.jwt,
    disabledButtons,
    requesterRoles,
    createOnSubmitWithFeedbackKind,
    setValidatorWarningMessage,
    currentUser,
    broadcastErrorFeedback: broadcastErrorFeedback ?? null,
  });

  const isAssessmentSignPrimary = isAssessmentToBeSignedByBeneficiary({
    requesterRoles,
    assessment: convention.assessment,
  });

  const { leftButtons, rightButtons, modals } = renderButtonsBySubStatus({
    buttonConfig,
    subStatus,
    isAssessmentSignPrimary,
  });

  const isLayoutDesktop = useBreakpoint("md");

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--background-raised-grey)",
        padding: ".3rem",
        zIndex: 10,
        borderTop: "1px solid var(--border-default-grey)",
      }}
    >
      {validatorWarningMessage && (
        <Alert
          closable
          onClose={() => setValidatorWarningMessage(null)}
          description={validatorWarningMessage}
          severity="warning"
          title="Attention !"
        />
      )}

      <Feedback
        topics={[
          "transfer-convention-to-agency",
          "convention-action-accept-by-counsellor",
          "convention-action-accept-by-validator",
          "convention-action-reject",
          "convention-action-deprecate",
          "convention-action-cancel",
          "convention-action-renew",
          "convention-action-edit-counsellor-name",
          "delete-assessment",
          "partner-conventions",
          "edit-convention-with-final-status",
        ]}
        className={fr.cx("fr-mb-2w")}
        closable
      />

      <div
        className={fr.cx("fr-container", "fr-py-1w")}
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        {isLayoutDesktop ? (
          <ConventionManageActionsButtonsDesktop
            leftButtons={leftButtons}
            rightButtons={rightButtons}
          />
        ) : (
          <>
            <Button
              id={domElementIds.manageConvention.mobileManageConventionButton}
              className={fr.cx("fr-container")}
              onClick={() => mobileManageConventionModal.open()}
            >
              Gérer la convention
            </Button>
            {createPortal(
              <mobileManageConventionModal.Component title="Actions">
                <ConventionManageActionsButtonsMobile
                  leftButtons={leftButtons}
                  rightButtons={rightButtons}
                />
              </mobileManageConventionModal.Component>,
              document.body,
            )}
          </>
        )}
      </div>
      {modals}
    </div>
  );
};

const ConventionManageActionsButtonsDesktop = ({
  leftButtons,
  rightButtons,
}: {
  leftButtons: ReactNode[];
  rightButtons: ReactNode[];
}) => (
  <>
    {leftButtons.length > 0 && (
      <div
        style={{
          display: "flex",
          gap: "1rem",
        }}
      >
        {leftButtons}
      </div>
    )}
    {rightButtons.length > 0 && (
      <div style={{ marginLeft: "auto" }}>
        <div
          style={{
            display: "flex",
            gap: "1rem",
          }}
        >
          {rightButtons}
        </div>
      </div>
    )}
  </>
);

const ConventionManageActionsButtonsMobile = ({
  leftButtons,
  rightButtons,
}: {
  leftButtons: ReactNode[];
  rightButtons: ReactNode[];
}) => (
  <div className={fr.cx("fr-container")}>
    <div
      style={{
        display: "flex",
        gap: "1rem",
        flexDirection: "column-reverse",
        marginBottom: "1rem",
      }}
    >
      {rightButtons.length > 0 && rightButtons}
    </div>
    <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
      {leftButtons.length > 0 && leftButtons}
    </div>
  </div>
);
