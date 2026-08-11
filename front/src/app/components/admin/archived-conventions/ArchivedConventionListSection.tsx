import Table from "@codegouvfr/react-dsfr/Table";
import { useEffect } from "react";
import { HeadingSection, Loader } from "react-design-system";
import { useDispatch, useSelector } from "react-redux";
import {
  type ArchivedConventionRequestToReviewDto,
  getFormattedFirstnameAndLastname,
  toDisplayedDate,
} from "shared";
import { archiveReasonContentMapping } from "src/app/contents/convention-archive/conventionArchive.helpers";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { archivedConventionRequestSelectors } from "src/core-logic/domain/convention/archivedConventionRequest.selectors";
import { archivedConventionRequestSlice } from "src/core-logic/domain/convention/archivedConventionRequest.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { WithFeedbackReplacer } from "../../feedback/WithFeedbackReplacer";

export const ArchivedConventionListSection = () => {
  const feedbackTopic: FeedbackTopic = "archived-convention-request-list";
  const dispatch = useDispatch();
  const jwt = useAppSelector(authSelectors.connectedUserJwt);

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

  return (
    <HeadingSection title="Demandes de désarchivage">
      {isLoading && <Loader />}
      <WithFeedbackReplacer topic={feedbackTopic} level="error" />
      {archivedConventionListToReview !== null && (
        <Table
          fixed
          data={archivedConventionListToReview.map(
            makeArchivedConventionListLine,
          )}
          headers={["Demandeur", "Date", "Raison"]}
        />
      )}
    </HeadingSection>
  );
};

const makeArchivedConventionListLine = ({
  reason,
  createdAt,
  id: _,
  requester,
}: ArchivedConventionRequestToReviewDto): React.ReactNode[] => [
  <>
    <strong>
      {getFormattedFirstnameAndLastname({
        firstname: requester.firstname,
        lastname: requester.lastname,
      })}
    </strong>
    <br />
    {requester.email}
  </>,
  toDisplayedDate({ date: new Date(createdAt) }),
  archiveReasonContentMapping[reason],
];
