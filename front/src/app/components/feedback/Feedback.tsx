import Alert from "@codegouvfr/react-dsfr/Alert";
import type { ReactNode } from "react";
import { useDispatch } from "react-redux";
import { errors, safeParseJson } from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  type FeedbackLevel,
  feedbackSlice,
} from "src/core-logic/domain/feedback/feedback.slice";

type FeedbackProps = {
  topics: FeedbackTopic[];
  render?: (props: {
    level: FeedbackLevel;
    title?: string;
    message: string;
  }) => JSX.Element;
  closable?: boolean;
  children?: ReactNode;
  className?: string;
};

const formatFeedbackMessage = (message: string) => {
  const parsedMessage = safeParseJson(message);
  if (parsedMessage && "issues" in parsedMessage) {
    return errors.generic.zodIssues({
      schemaName: parsedMessage.schemaName,
      issues: parsedMessage.issues,
    }).message;
  }
  if (parsedMessage && "message" in parsedMessage) {
    return errors.generic.httpStatus({
      status: parsedMessage.status,
      message: parsedMessage.message,
    }).message;
  }
  return message;
};

export const Feedback = ({
  topics = [],
  render,
  closable,
  className,
}: FeedbackProps): JSX.Element | null => {
  const dispatch = useDispatch();
  const feedbacks = useAppSelector(feedbacksSelectors.feedbacks);
  const relevantFeedbacks = topics.flatMap((topic) => {
    const feedback = feedbacks[topic];
    return feedback ? [{ ...feedback, topic }] : [];
  });

  if (relevantFeedbacks.length === 0) return null;

  if (render) {
    return (
      <>
        {relevantFeedbacks.map((feedback) => (
          <div key={feedback.topic}>
            {render({
              level: feedback.level,
              title: feedback.title,
              message: feedback.message,
            })}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {relevantFeedbacks.map((feedback) => (
        <Alert
          key={feedback.topic}
          severity={feedback.level}
          title={feedback.title}
          description={formatFeedbackMessage(feedback.message)}
          small
          closable={closable}
          className={className}
          onClose={
            closable === true
              ? () => {
                  dispatch(
                    feedbackSlice.actions.clearFeedbackTopics([feedback.topic]),
                  );
                }
              : undefined
          }
        />
      ))}
    </>
  );
};
