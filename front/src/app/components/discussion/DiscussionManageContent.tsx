import { useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import type { ExchangeRole, WithDiscussionId } from "shared";
import { useDiscussion } from "src/app/hooks/discussion.hooks";
import { useFeedbackEventCallback } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { discussionSlice } from "src/core-logic/domain/discussion/discussion.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import { WithFeedbackReplacer } from "../feedback/WithFeedbackReplacer";
import { DiscussionDetails } from "./DiscussionDetails";

type DiscussionManageContentProps = WithDiscussionId & {
  viewer: ExchangeRole;
};

export const DiscussionManageContent = ({
  discussionId,
  viewer,
}: DiscussionManageContentProps): JSX.Element => {
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const { discussion, isLoading } = useDiscussion(
    discussionId,
    connectedUserJwt,
  );
  const dispatch = useDispatch();
  const showDiscussion = !isLoading && discussion && currentUser;

  useFeedbackEventCallback(
    "dashboard-discussion-status-updated",
    "update.success",
    () => {
      if (connectedUserJwt) {
        dispatch(
          discussionSlice.actions.fetchDiscussionRequested({
            discussionId,
            feedbackTopic: "dashboard-discussion",
            jwt: connectedUserJwt,
          }),
        );
      }
    },
  );

  useEffect(() => {
    if (discussion && connectedUserJwt) {
      dispatch(
        searchSlice.actions.fetchSearchResultRequested({
          searchResult: {
            siret: discussion.siret,
            appellationCode: discussion.appellation.appellationCode,
            locationId: discussion.locationId,
          },
          feedbackTopic: "unused",
        }),
      );
    }
  }, [discussion, connectedUserJwt, dispatch]);

  useEffect(() => {
    if (discussion && connectedUserJwt) {
      dispatch(
        discussionSlice.actions.fetchDiscussionEstablishmentContactInfoRequested(
          {
            discussionId: discussion.id,
            jwt: connectedUserJwt,
            feedbackTopic: "dashboard-discussion-contact-info",
          },
        ),
      );
    }
  }, [discussion, connectedUserJwt, dispatch]);

  useEffect(
    () => () => {
      dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
    },
    [dispatch],
  );

  return (
    <>
      {isLoading && <Loader />}
      <WithFeedbackReplacer topic="dashboard-discussion" level="error">
        {showDiscussion && (
          <DiscussionDetails
            discussion={discussion}
            connectedUser={currentUser}
            viewer={viewer}
          />
        )}
      </WithFeedbackReplacer>
    </>
  );
};
