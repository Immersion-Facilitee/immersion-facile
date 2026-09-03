import { fr } from "@codegouvfr/react-dsfr";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import Table from "@codegouvfr/react-dsfr/Table";
import { useEffect, useState } from "react";
import { HeadingSection, Loader } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  type ArchivedConventionRequestHandledStatus,
  type ArchivedConventionRequestToReviewDto,
  domElementIds,
  getFormattedFirstnameAndLastname,
  toDisplayedDate,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { archiveReasonContentMapping } from "src/app/contents/convention-archive/conventionArchive.helpers";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { archivedConventionRequestSelectors } from "src/core-logic/domain/convention/archivedConventionRequest.selectors";
import { archivedConventionRequestSlice } from "src/core-logic/domain/convention/archivedConventionRequest.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { WithFeedbackReplacer } from "../../feedback/WithFeedbackReplacer";
import { HandleArchivedConventionRequestModalContent } from "./HandleArchivedConventionRequestModalContent";

const handleArchivedConventionRequestModalConfig = {
  isOpenedByDefault: false,
  id: domElementIds.adminConventions.handleArchivedConventionRequestModal,
};

const {
  Component: HandleArchivedConventionRequestModal,
  open: openHandleArchivedConventionRequestModal,
} = createModal(handleArchivedConventionRequestModalConfig);

const handleFeedbackTopic: FeedbackTopic = "archived-convention-request-handle";

export const ArchivedConventionListSection = () => {
  const feedbackTopic: FeedbackTopic = "archived-convention-request-list";
  const dispatch = useDispatch();
  const jwt = useAppSelector(authSelectors.connectedUserJwt);
  const [selectedRequest, setSelectedRequest] =
    useState<ArchivedConventionRequestToReviewDto | null>(null);

  const archivedConventionListToReview = useSelector(
    archivedConventionRequestSelectors.archivedConventionListToReview,
  );
  const isLoading = useSelector(archivedConventionRequestSelectors.isLoading);

  useEffect(() => {
    if (jwt && !isLoading && archivedConventionListToReview === null)
      dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionRequestToReviewListRequested(
          {
            jwt,
            feedbackTopic,
          },
        ),
      );
  }, [jwt, isLoading, dispatch, archivedConventionListToReview]);

  useEffect(
    () => () => {
      dispatch(
        archivedConventionRequestSlice.actions.fetchArchivedConventionListToReviewCleared(),
      );
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );

  const handleArchivedConventionRequest = (
    status: ArchivedConventionRequestHandledStatus,
  ) => {
    if (!jwt || !selectedRequest) return;
    dispatch(
      archivedConventionRequestSlice.actions.handleArchivedConventionRequestRequested(
        {
          archivedConventionRequestId: selectedRequest.id,
          status,
          jwt,
          feedbackTopic: handleFeedbackTopic,
        },
      ),
    );
  };

  return (
    <HeadingSection title="Demandes de désarchivage">
      {isLoading && <Loader />}
      <Feedback topics={[handleFeedbackTopic]} closable />
      <WithFeedbackReplacer topic={feedbackTopic} level="error" />
      {archivedConventionListToReview !== null &&
        (archivedConventionListToReview.length > 0 ? (
          <Table
            fixed
            data={archivedConventionListToReview.map((request) =>
              makeArchivedConventionListLine(request, () => {
                setSelectedRequest(request);
                openHandleArchivedConventionRequestModal();
              }),
            )}
            headers={["Demandeur", "Date", "Raison", "Actions"]}
          />
        ) : (
          <p>Il n'y a aucune demande en cours.</p>
        ))}
      {createPortal(
        <HandleArchivedConventionRequestModal
          title="Traiter la demande de désarchivage"
          buttons={
            selectedRequest
              ? [
                  {
                    children: "Refuser la demande",
                    priority: "secondary",
                    disabled: isLoading,
                    type: "button",
                    id: `${domElementIds.adminConventions.refuseArchivedConventionRequestButton}--${selectedRequest.id}`,
                    onClick: () => handleArchivedConventionRequest("REJECTED"),
                  },
                  {
                    children: "Marquer comme traitée",
                    disabled: isLoading,
                    type: "button",
                    id: `${domElementIds.adminConventions.markArchivedConventionRequestAsTreatedButton}--${selectedRequest.id}`,
                    onClick: () => handleArchivedConventionRequest("TREATED"),
                  },
                ]
              : undefined
          }
        >
          {selectedRequest && (
            <HandleArchivedConventionRequestModalContent
              request={selectedRequest}
            />
          )}
        </HandleArchivedConventionRequestModal>,
        document.body,
      )}
    </HeadingSection>
  );
};

const makeArchivedConventionListLine = (
  archivedConventionRequest: ArchivedConventionRequestToReviewDto,
  onClick: () => void,
): React.ReactNode[] => [
  <>
    <strong>
      {getFormattedFirstnameAndLastname({
        firstname: archivedConventionRequest.requester.firstname,
        lastname: archivedConventionRequest.requester.lastname,
      })}
    </strong>
    <br />
    {archivedConventionRequest.requester.email}
  </>,
  toDisplayedDate({ date: new Date(archivedConventionRequest.createdAt) }),
  archiveReasonContentMapping[archivedConventionRequest.reason],
  <ButtonsGroup
    key={`${archivedConventionRequest.id}-actions`}
    inlineLayoutWhen="always"
    buttons={[
      {
        children: "Traiter la demande",
        priority: "secondary",
        className: fr.cx("fr-my-1v"),
        id: `${domElementIds.adminConventions.handleArchivedConventionRequestButton}--${archivedConventionRequest.id}`,
        onClick,
      },
    ]}
  />,
];
