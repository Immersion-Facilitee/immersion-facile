import { type ReactNode, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  decodeMagicLinkJwtWithoutSignatureCheck,
  type OtpJwt,
  type OtpJwtPayload,
} from "shared";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { OtpChallengePage } from "src/app/pages/auth/OtpChallengePage";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { otpSessionSelectors } from "src/core-logic/domain/otpSession/otpSession.selectors";
import { otpSessionSlice } from "src/core-logic/domain/otpSession/otpSession.slice";

const otpSessionFeedbackTopic: FeedbackTopic = "otp-session";

type OtpPrivateRoutePageProps = {
  jwt: OtpJwt;
  children: ReactNode;
};

export const OtpPrivateRoutePage = ({
  jwt,
  children,
}: OtpPrivateRoutePageProps): JSX.Element => {
  const dispatch = useDispatch();
  const { purpose, subject } =
    decodeMagicLinkJwtWithoutSignatureCheck<OtpJwtPayload>(jwt);
  const { conventionId } = subject;
  const activeSession = useAppSelector(otpSessionSelectors.activeSession);
  const isOtpRequired = useAppSelector(otpSessionSelectors.isOtpRequired);
  const otpSessionFeedback = useFeedbackTopic(otpSessionFeedbackTopic);

  useEffect(() => {
    dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        purpose,
        conventionId,
        feedbackTopic: otpSessionFeedbackTopic,
      }),
    );
    return () => {
      dispatch(otpSessionSlice.actions.resetOtpSessionRequested());
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics([otpSessionFeedbackTopic]),
      );
    };
  }, [dispatch, purpose, conventionId]);

  if (otpSessionFeedback?.level === "error")
    throw frontErrors.convention.otpSessionRefused({
      conventionId,
      errorMessage: otpSessionFeedback.message,
    });

  if (activeSession?.conventionId === conventionId) return <>{children}</>;

  if (isOtpRequired) return <OtpChallengePage jwt={jwt} />;

  return <Loader />;
};
