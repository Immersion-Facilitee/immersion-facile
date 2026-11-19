import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Button from "@codegouvfr/react-dsfr/Button";
import { useDispatch } from "react-redux";
import {
  type ConnectedUserJwt,
  type ConventionJwt,
  domElementIds,
  type EmailAuthCodeJwt,
  type OAuthState,
  type OtpJwt,
  type ShortLinkId,
} from "shared";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { Feedback } from "../feedback/Feedback";

export const RenewExpiredJwtButton = ({
  expiredJwt,
  feedbackTopic,
  state,
  originalUrl,
  shortLinkId,
}: {
  expiredJwt: ConventionJwt | ConnectedUserJwt | EmailAuthCodeJwt | OtpJwt;
  feedbackTopic: FeedbackTopic;
  state?: OAuthState;
  originalUrl?: string;
  shortLinkId?: ShortLinkId;
}): React.JSX.Element => {
  const dispatch = useDispatch();
  const onClick = async () => {
    dispatch(
      authSlice.actions.renewExpiredJwtRequested({
        expiredJwt,
        originalUrl,
        shortLinkId,
        state,
        feedbackTopic,
      }),
    );
  };

  const isRequestingRenewExpiredJwt = useAppSelector(
    authSelectors.isRequestingRenewExpiredJwt,
  );

  const renewExpiredJwtFeedback = useFeedbackTopic(feedbackTopic);

  return (
    <>
      <Button
        priority="primary"
        disabled={
          isRequestingRenewExpiredJwt ||
          renewExpiredJwtFeedback?.level === "success"
        }
        onClick={onClick}
        nativeButtonProps={{
          id: domElementIds.magicLinkInterstitial.renewalButton,
        }}
      >
        Demander un nouveau lien
      </Button>
      <Feedback
        topics={[feedbackTopic]}
        render={({ level, message }) => (
          <Alert
            small
            description={message}
            severity={level}
            className={fr.cx("fr-mt-2w")}
          />
        )}
      />
    </>
  );
};
