import { type ReactNode, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  decodeMagicLinkJwtWithoutSignatureCheck,
  type VisitorOtpJwt,
  type VisitorOtpJwtPayload,
} from "shared";
import { OtpChallenge } from "src/app/components/auth/OtpChallenge";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { visitorSessionSelectors } from "src/core-logic/domain/visitorSession/visitorSession.selectors";
import { visitorSessionSlice } from "src/core-logic/domain/visitorSession/visitorSession.slice";

const visitorSessionFeedbackTopic: FeedbackTopic = "visitor-session";

type VisitorPrivateRoutePageProps = {
  jwt: VisitorOtpJwt;
  children: ReactNode;
};

export const VisitorPrivateRoutePage = ({
  jwt,
  children,
}: VisitorPrivateRoutePageProps): JSX.Element => {
  const dispatch = useDispatch();
  const { purpose, subject } =
    decodeMagicLinkJwtWithoutSignatureCheck<VisitorOtpJwtPayload>(jwt);
  const { conventionId } = subject;
  const activeSession = useAppSelector(visitorSessionSelectors.activeSession);
  const isOtpRequired = useAppSelector(visitorSessionSelectors.isOtpRequired);
  const visitorSessionFeedback = useFeedbackTopic(visitorSessionFeedbackTopic);

  useEffect(() => {
    dispatch(
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose,
        conventionId,
        feedbackTopic: visitorSessionFeedbackTopic,
      }),
    );
    return () => {
      dispatch(visitorSessionSlice.actions.resetVisitorSessionRequested());
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics([
          visitorSessionFeedbackTopic,
        ]),
      );
    };
  }, [dispatch, purpose, conventionId]);

  if (visitorSessionFeedback?.level === "error")
    throw frontErrors.convention.visitorSessionRefused({
      conventionId,
      errorMessage: visitorSessionFeedback.message,
    });

  if (activeSession?.conventionId === conventionId) return <>{children}</>;

  if (isOtpRequired) return <OtpChallenge jwt={jwt} />;

  return <Loader />;
};
