import { type ActiveVisitorSession, expectToEqual } from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  visitorSessionInitialState,
  visitorSessionSlice,
} from "src/core-logic/domain/visitorSession/visitorSession.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("visitorSession slice", () => {
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const activeSession: ActiveVisitorSession = {
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
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "visitor-session",
      }),
    );
    expectToEqual(store.getState().visitorSession, { status: "loading" });
  });

  it("stores the active session", () => {
    store.dispatch(
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "visitor-session",
      }),
    );
    dependencies.otpChallengeGateway.visitorSessionResponse$.next(
      activeSession,
    );

    expectToEqual(store.getState().visitorSession, {
      status: "active",
      activeSession,
    });
  });

  it("requires an otp when there is no session", () => {
    store.dispatch(
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "visitor-session",
      }),
    );
    dependencies.otpChallengeGateway.visitorSessionResponse$.next(null);

    expectToEqual(store.getState().visitorSession, { status: "otpRequired" });
  });

  it("stores the back message when the request fails", () => {
    store.dispatch(
      visitorSessionSlice.actions.visitorSessionRequested({
        purpose: "manageConvention",
        conventionId,
        feedbackTopic: "visitor-session",
      }),
    );

    const errorMessage =
      "L'email saisi dans la convention a été modifié. Vous ne pouvez plus accéder à cette convention avec l'email que vous venez d'utiliser.";
    dependencies.otpChallengeGateway.visitorSessionResponse$.error(
      new Error(errorMessage),
    );

    expectToEqual(store.getState().visitorSession, visitorSessionInitialState);
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["visitor-session"],
      {
        on: "fetch",
        level: "error",
        title: "Problème lors de la récupération de votre session",
        message: errorMessage,
      },
    );
  });

  it("resets the visitor session", () => {
    ({ store } = createTestStore({
      visitorSession: {
        status: "active",
        activeSession,
      },
    }));

    store.dispatch(visitorSessionSlice.actions.resetVisitorSessionRequested());

    expectToEqual(store.getState().visitorSession, visitorSessionInitialState);
  });
});
