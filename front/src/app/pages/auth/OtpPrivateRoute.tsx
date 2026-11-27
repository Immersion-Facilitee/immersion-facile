import { type ReactNode, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ActiveOtpSession,
  decodeMagicLinkJwtWithoutSignatureCheck,
  type frontRoutes,
  type GetOtpSessionQueryParams,
  type OtpDomainJwtPayload,
  type OtpJwt,
  type OtpJwtPayload,
} from "shared";
import { useFeedbackTopic } from "src/app/hooks/feedback.hooks";
import { isOtpJwt } from "src/app/hooks/jwt.hooks";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { OtpChallengePage } from "src/app/pages/auth/OtpChallengePage";
import { frontErrors } from "src/app/pages/error/front-errors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import {
  type Feedback,
  feedbackSlice,
} from "src/core-logic/domain/feedback/feedback.slice";
import { otpSessionSelectors } from "src/core-logic/domain/otpSession/otpSession.selectors";
import { otpSessionSlice } from "src/core-logic/domain/otpSession/otpSession.slice";
import { match } from "ts-pattern";
import type { Route } from "type-route";

const otpSessionFeedbackTopic: FeedbackTopic = "otp-session";

type OtpProtectedRoute =
  | Route<typeof frontRoutes.conventionImmersion>
  | Route<typeof frontRoutes.conventionMiniStage>
  | Route<typeof frontRoutes.conventionDocument>
  | Route<typeof frontRoutes.assessment>
  | Route<typeof frontRoutes.assessmentDocument>
  | Route<typeof frontRoutes.manageConvention>;

type OtpPrivateRouteProps = {
  route: OtpProtectedRoute;
  children: ReactNode;
};

export const OtpPrivateRoute = ({
  route,
  children,
}: OtpPrivateRouteProps): JSX.Element => {
  const jwt = route.params.jwt;

  if (!jwt || !isOtpJwt(jwt)) return <>{children}</>;

  return <OtpSessionGuard jwt={jwt}>{children}</OtpSessionGuard>;
};

type OtpSessionGuardProps = {
  jwt: OtpJwt;
  children: ReactNode;
};

const OtpSessionGuard = ({
  jwt,
  children,
}: OtpSessionGuardProps): JSX.Element => {
  const dispatch = useDispatch();

  const activeSession = useAppSelector(otpSessionSelectors.activeSession);
  const isLoading = useAppSelector(otpSessionSelectors.isLoading);
  const otpSessionFeedback = useFeedbackTopic(otpSessionFeedbackTopic);

  const otpJwtPayload =
    decodeMagicLinkJwtWithoutSignatureCheck<OtpJwtPayload>(jwt);

  useEffect(() => {
    const otpSessionQueryParams: GetOtpSessionQueryParams = match(
      decodeMagicLinkJwtWithoutSignatureCheck<OtpJwtPayload>(jwt),
    )
      .with(
        { purpose: "manageConvention" },
        ({ subject }): GetOtpSessionQueryParams => ({
          purpose: "manageConvention",
          conventionId: subject.conventionId,
        }),
      )
      .exhaustive();

    dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        ...otpSessionQueryParams,
        feedbackTopic: otpSessionFeedbackTopic,
      }),
    );
    return () => {
      dispatch(otpSessionSlice.actions.resetOtpSessionRequested());
      dispatch(
        feedbackSlice.actions.clearFeedbackTopics([otpSessionFeedbackTopic]),
      );
    };
  }, [dispatch, jwt]);

  throwIfOtpSessionRefused({ otpJwtPayload, otpSessionFeedback });

  if (isLoading) return <Loader />;

  if (
    activeSession &&
    isActiveSessionMatchingOtpJwtPayload({ activeSession, otpJwtPayload })
  )
    return <>{children}</>;

  return <OtpChallengePage jwt={jwt} />;
};

const isActiveSessionMatchingOtpJwtPayload = ({
  activeSession,
  otpJwtPayload,
}: {
  activeSession: ActiveOtpSession;
  otpJwtPayload: OtpDomainJwtPayload;
}): boolean =>
  match(otpJwtPayload)
    .with(
      { purpose: "manageConvention" },
      ({ subject }) =>
        activeSession.purpose === "manageConvention" &&
        activeSession.conventionId === subject.conventionId &&
        activeSession.role === subject.role,
    )
    .exhaustive();

const throwIfOtpSessionRefused = ({
  otpJwtPayload,
  otpSessionFeedback,
}: {
  otpJwtPayload: OtpDomainJwtPayload;
  otpSessionFeedback: Feedback | undefined;
}): void => {
  if (otpSessionFeedback?.level !== "error") return;

  throw match(otpJwtPayload)
    .with({ purpose: "manageConvention" }, ({ subject }) =>
      frontErrors.convention.otpSessionRefused({
        conventionId: subject.conventionId,
        errorMessage: otpSessionFeedback.message,
      }),
    )
    .exhaustive();
};
