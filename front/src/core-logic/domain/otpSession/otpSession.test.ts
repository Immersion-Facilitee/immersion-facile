import { type ActiveOtpSession, expectToEqual } from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  otpSessionInitialState,
  otpSessionSlice,
} from "src/core-logic/domain/otpSession/otpSession.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("otpSession slice", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const activeSession: ActiveOtpSession = {
    purpose: "manageConvention",
    conventionId,
    role: "beneficiary",
    expiresAt: "2026-11-11T12:30:00.000Z",
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("is loading while the session is requested", () => {
    store.dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "otp-session",
      }),
    );
    expectToEqual(store.getState().otpSession, {
      isLoading: true,
      hasCheckedSession: false,
      activeSession: null,
    });
  });

  it("stores the active session", () => {
    store.dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "otp-session",
      }),
    );
    dependencies.otpChallengeGateway.otpSessionResponse$.next(activeSession);

    expectToEqual(store.getState().otpSession, {
      isLoading: false,
      hasCheckedSession: true,
      activeSession,
    });
  });

  it("requires an otp when there is no session", () => {
    store.dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "otp-session",
      }),
    );
    dependencies.otpChallengeGateway.otpSessionResponse$.next(null);

    expectToEqual(store.getState().otpSession, {
      isLoading: false,
      hasCheckedSession: true,
      activeSession: null,
    });
  });

  it("stores the back message when the request fails", () => {
    store.dispatch(
      otpSessionSlice.actions.otpSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "otp-session",
      }),
    );

    const errorMessage =
      "L'email saisi dans la convention a été modifié. Vous ne pouvez plus accéder à cette convention avec l'email que vous venez d'utiliser.";
    dependencies.otpChallengeGateway.otpSessionResponse$.error(
      new Error(errorMessage),
    );

    expectToEqual(store.getState().otpSession, otpSessionInitialState);
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["otp-session"],
      {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération de votre session",
        message: errorMessage,
      },
    );
  });

  it("resets the otp session", () => {
    ({ store } = createTestStore({
      otpSession: {
        isLoading: false,
        hasCheckedSession: true,
        activeSession,
      },
    }));

    store.dispatch(otpSessionSlice.actions.resetOtpSessionRequested());

    expectToEqual(store.getState().otpSession, otpSessionInitialState);
  });
});
