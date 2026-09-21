import { type ReactNode, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  type FeedbackLevel,
  feedbackSlice,
} from "src/core-logic/domain/feedback/feedback.slice";

type WithFeedbackReplacerProps = {
  topic: FeedbackTopic;
  level?: FeedbackLevel;
  renderFeedback?: (props: {
    level: FeedbackLevel;
    title?: string;
    message: string;
  }) => ReactNode;
  children?: ReactNode;
};

export const WithFeedbackReplacer = ({
  topic,
  level,
  children,
  renderFeedback,
}: WithFeedbackReplacerProps) => {
  const feedbacks = useAppSelector(feedbacksSelectors.feedbacks);
  const feedback = feedbacks[topic];
  const dispatch = useDispatch();
  useEffect(
    () => () => {
      if (feedback) {
        dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
      }
    },
    [dispatch, feedback],
  );
  if (!feedback && children) return children;
  if (level && feedback && feedback.level !== level) return children;
  return renderFeedback && feedback ? (
    renderFeedback({
      level: feedback.level,
      title: feedback.title,
      message: feedback.message,
    })
  ) : (
    <Feedback topics={[topic]} />
  );
};
