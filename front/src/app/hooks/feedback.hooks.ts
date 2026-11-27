import { useCallback, useEffect } from "react";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import type {
  ActionKindAndLevel,
  Feedback,
} from "src/core-logic/domain/feedback/feedback.slice";

export const useFeedbackEventCallback = (
  topic: FeedbackTopic,
  event: ActionKindAndLevel,
  callback: () => void,
) => {
  const feedback = useFeedbackTopic(topic);
  const memoizedCallback = useCallback(callback, []);
  useEffect(() => {
    if (!feedback) return;
    if (event === `${feedback.on}.${feedback.level}`) {
      memoizedCallback();
    }
  }, [feedback, memoizedCallback, event]);
};

export const useFeedbackTopics = (topics: FeedbackTopic[]): Feedback[] => {
  const feedbacks = useAppSelector(feedbacksSelectors.feedbacks);
  return topics.map((t) => feedbacks[t]).filter((item) => !!item);
};

export const useFeedbackTopic = (
  topic: FeedbackTopic,
): Feedback | undefined => {
  const feedbacks = useFeedbackTopics([topic]);
  return feedbacks[0];
};
