import { expectToEqual, type MaskedOtpRecipients } from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import type { Feedback } from "src/core-logic/domain/feedback/feedback.slice";
import {
  type OtpChallengeState,
  otpChallengeInitialState,
  otpChallengeSlice,
} from "src/core-logic/domain/otpChallenge/otpChallenge.slice";
import { visitorSessionInitialState } from "src/core-logic/domain/visitorSession/visitorSession.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("otpChallenge slice", () => {
  const jwt = "visitor-otp-jwt";
  const conventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const maskedRecipients: MaskedOtpRecipients = {
    maskedEmail: "j***@mail.com",
    maskedPhone: "+33******78",
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("fetches masked recipients", () => {
    store.dispatch(
      otpChallengeSlice.actions.maskedOtpRecipientsRequested({
        jwt,
        feedbackTopic: "otp-challenge",
      }),
    );
    expectOtpChallengeState({ isLoading: true });

    feedMaskedOtpRecipients(maskedRecipients);

    expectOtpChallengeState({ maskedRecipients });
  });

  it("shows the back message when fetching masked recipients fails", () => {
    store.dispatch(
      otpChallengeSlice.actions.maskedOtpRecipientsRequested({
        jwt,
        feedbackTopic: "otp-challenge",
      }),
    );

    feedMaskedOtpRecipients(new Error("Convention introuvable."));

    expectOtpChallengeState(otpChallengeInitialState);
    expectOtpChallengeFeedback({
      on: "fetch",
      level: "error",
      title: "Problème lors de la récupération de vos coordonnées",
      message: "Convention introuvable.",
    });
  });

  it("requests an otp challenge", () => {
    store.dispatch(
      otpChallengeSlice.actions.otpChallengeRequested({
        jwt,
        channel: "email",
        feedbackTopic: "otp-challenge",
      }),
    );
    expectOtpChallengeState({ isLoading: true });

    dependencies.otpChallengeGateway.requestOtpChallengeResponse$.next();

    expectOtpChallengeState({ isCodeSent: true });
    expectOtpChallengeFeedback({
      on: "create",
      level: "success",
      title: "Le code a bien été envoyé",
      message: "Vous devriez le recevoir dans les prochaines minutes.",
    });
  });

  it("shows the back message when requesting an otp challenge is rate limited", () => {
    store.dispatch(
      otpChallengeSlice.actions.otpChallengeRequested({
        jwt,
        channel: "sms",
        feedbackTopic: "otp-challenge",
      }),
    );

    dependencies.otpChallengeGateway.requestOtpChallengeResponse$.error(
      new Error("Trop de demandes de code, réessayez plus tard."),
    );

    expectOtpChallengeState(otpChallengeInitialState);
    expectOtpChallengeFeedback({
      on: "create",
      level: "error",
      title: "Problème lors de l'envoi du code",
      message: "Trop de demandes de code, réessayez plus tard.",
    });
  });

  it("verifies an otp challenge and activates the returned visitor session", () => {
    store.dispatch(
      otpChallengeSlice.actions.otpChallengeVerificationRequested({
        jwt,
        otpCode: "123456",
        feedbackTopic: "otp-challenge",
      }),
    );
    expectOtpChallengeState({ isLoading: true });

    dependencies.otpChallengeGateway.verifyOtpChallengeResponse$.next({
      purpose: "manageConvention",
      conventionId,
      role: "beneficiary",
      expiresAt: "2026-11-11T12:30:00.000Z",
    });

    expectOtpChallengeState({ isVerified: true });
    expectToEqual(store.getState().visitorSession, {
      status: "active",
      activeSession: {
        purpose: "manageConvention",
        conventionId,
        role: "beneficiary",
        expiresAt: "2026-11-11T12:30:00.000Z",
      },
    });
  });

  it("keeps the visitor session unchanged and shows the back message when the code is wrong", () => {
    store.dispatch(
      otpChallengeSlice.actions.otpChallengeVerificationRequested({
        jwt,
        otpCode: "000000",
        feedbackTopic: "otp-challenge",
      }),
    );

    dependencies.otpChallengeGateway.verifyOtpChallengeResponse$.error(
      new Error("Le code est invalide."),
    );

    expectOtpChallengeState(otpChallengeInitialState);
    expectToEqual(store.getState().visitorSession, visitorSessionInitialState);
    expectOtpChallengeFeedback({
      on: "update",
      level: "error",
      title: "Problème lors de la vérification du code",
      message: "Le code est invalide.",
    });
  });

  it("clears the sent code when the channel changes", () => {
    ({ store } = createTestStore({
      otpChallenge: {
        maskedRecipients,
        isCodeSent: true,
        isVerified: false,
        isLoading: false,
      },
    }));

    store.dispatch(otpChallengeSlice.actions.otpChannelChangeRequested());

    expectOtpChallengeState({ maskedRecipients, isCodeSent: false });
  });

  it("resets the otp challenge state", () => {
    ({ store } = createTestStore({
      otpChallenge: {
        maskedRecipients,
        isCodeSent: true,
        isVerified: true,
        isLoading: false,
      },
    }));

    store.dispatch(otpChallengeSlice.actions.resetOtpChallengeRequested());

    expectOtpChallengeState(otpChallengeInitialState);
  });

  const expectOtpChallengeState = (
    otpChallengeState: Partial<OtpChallengeState>,
  ) => {
    expectToEqual(store.getState().otpChallenge, {
      ...otpChallengeInitialState,
      ...otpChallengeState,
    });
  };

  const expectOtpChallengeFeedback = (feedback: Feedback) => {
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["otp-challenge"],
      feedback,
    );
  };

  const feedMaskedOtpRecipients = (
    maskedRecipientsOrError: MaskedOtpRecipients | Error,
  ) => {
    maskedRecipientsOrError instanceof Error
      ? dependencies.otpChallengeGateway.maskedOtpRecipientResponse$.error(
          maskedRecipientsOrError,
        )
      : dependencies.otpChallengeGateway.maskedOtpRecipientResponse$.next(
          maskedRecipientsOrError,
        );
  };
});
