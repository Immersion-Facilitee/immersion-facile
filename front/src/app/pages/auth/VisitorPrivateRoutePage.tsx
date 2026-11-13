import { type ReactNode, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import { type ConventionSupportedJwt, frontRoutes } from "shared";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { getConventionAccessFromJwt } from "src/app/hooks/jwt.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { visitorSessionSelectors } from "src/core-logic/domain/visitorSession/visitorSession.selectors";
import { visitorSessionSlice } from "src/core-logic/domain/visitorSession/visitorSession.slice";

const visitorSessionFeedbackTopic: FeedbackTopic = "visitor-session";

type VisitorPrivateRoutePageProps = {
  jwt: ConventionSupportedJwt;
  children: ReactNode;
};

export const VisitorPrivateRoutePage = ({
  jwt,
  children,
}: VisitorPrivateRoutePageProps): JSX.Element => {
  const dispatch = useDispatch();
  const conventionAccess = getConventionAccessFromJwt(jwt);
  const isVisitorOtp = conventionAccess?.isVisitorOtp ?? false;
  const conventionId = conventionAccess?.conventionId;
  const activeSession = useAppSelector(visitorSessionSelectors.activeSession);
  const isOtpRequired = useAppSelector(visitorSessionSelectors.isOtpRequired);
  const visitorSessionFeedback = useFeedbackTopic(visitorSessionFeedbackTopic);

  useEffect(() => {
    if (!isVisitorOtp || !conventionId) return;
    dispatch(
      feedbackSlice.actions.clearFeedbackTopics([visitorSessionFeedbackTopic]),
    );
    dispatch(
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: visitorSessionFeedbackTopic,
      }),
    );
  }, [dispatch, isVisitorOtp, conventionId]);

  useEffect(() => {
    if (isVisitorOtp && isOtpRequired)
      frontRoutes.otpChallenge({ jwt }).replace();
  }, [isVisitorOtp, isOtpRequired, jwt]);

  if (!conventionAccess?.isVisitorOtp) return <>{children}</>;
  if (isOtpRequired) return <Loader />;
  if (activeSession?.conventionId === conventionAccess.conventionId)
    return <>{children}</>;
  if (visitorSessionFeedback?.level === "error")
    throw frontErrors.convention.noRightsOnConvention({
      conventionId: conventionAccess.conventionId,
    });

  return <Loader />;
};
