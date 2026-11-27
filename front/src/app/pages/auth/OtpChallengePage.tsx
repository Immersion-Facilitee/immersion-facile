import { useEffect } from "react";
import { Loader, MainWrapper } from "react-design-system";
import { useDispatch } from "react-redux";
import { expiredJwtErrorMessage, type OtpJwt } from "shared";
import { OtpChannelStep } from "src/app/components/auth/OtpChannelStep";
import { OtpCodeStep } from "src/app/components/auth/OtpCodeStep";
import { RenewExpiredJwtButton } from "src/app/components/auth/RenewExpiredJwtButton";
import { Feedback } from "src/app/components/feedback/Feedback";
import { HeaderFooterLayout } from "src/app/components/layout/HeaderFooterLayout";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { otpChallengeSelectors } from "src/core-logic/domain/otpChallenge/otpChallenge.selectors";
import { otpChallengeSlice } from "src/core-logic/domain/otpChallenge/otpChallenge.slice";

const otpChallengeFeedbackTopic: FeedbackTopic = "otp-challenge";
const renewExpiredJwtFeedbackTopic: FeedbackTopic = "renew-expired-jwt";

type OtpChallengePageProps = {
  jwt: OtpJwt;
};

export const OtpChallengePage = ({
  jwt,
}: OtpChallengePageProps): JSX.Element => {
  const dispatch = useDispatch();
  const maskedRecipients = useAppSelector(
    otpChallengeSelectors.maskedRecipients,
  );
  const isCodeSent = useAppSelector(otpChallengeSelectors.isCodeSent);
  const isLoading = useAppSelector(otpChallengeSelectors.isLoading);
  const otpChallengeFeedback = useFeedbackTopic(otpChallengeFeedbackTopic);

  useEffect(() => {
    dispatch(
      otpChallengeSlice.actions.maskedOtpRecipientsRequested({
        jwt,
        feedbackTopic: otpChallengeFeedbackTopic,
      }),
    );
    return () => {
      dispatch(otpChallengeSlice.actions.resetOtpChallengeRequested());
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics([otpChallengeFeedbackTopic]),
      );
    };
  }, [dispatch, jwt]);

  if (
    otpChallengeFeedback?.level === "error" &&
    otpChallengeFeedback.message.includes(expiredJwtErrorMessage)
  )
    throw frontErrors.jwtLink.expired({
      RenewJwtButton: (
        <RenewExpiredJwtButton
          key={RenewExpiredJwtButton.name}
          expiredJwt={jwt}
          feedbackTopic={renewExpiredJwtFeedbackTopic}
        />
      ),
    });

  return (
    <HeaderFooterLayout>
      <MainWrapper layout="boxed" vSpacing={8}>
        {isLoading && <Loader />}
        {maskedRecipients === null && (
          <Feedback topics={[otpChallengeFeedbackTopic]} />
        )}
        {maskedRecipients !== null &&
          (isCodeSent ? (
            <OtpCodeStep jwt={jwt} maskedRecipients={maskedRecipients} />
          ) : (
            <OtpChannelStep jwt={jwt} maskedRecipients={maskedRecipients} />
          ))}
      </MainWrapper>
    </HeaderFooterLayout>
  );
};
