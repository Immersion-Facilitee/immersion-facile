import {
  type AbsoluteUrl,
  type ConventionDraftDto,
  type ConventionDraftId,
  expectObjectsToMatch,
  expectToEqual,
} from "shared";
import type { InMemoryNavigationGateway } from "src/core-logic/adapters/NavigationGateway/InMemoryNavigationGateway";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  type ConventionDraftState,
  conventionDraftSlice,
} from "./conventionDraft.slice";

describe("ConventionDraft slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  const conventionDraftId: ConventionDraftId =
    "aaaaac99-9c0b-1aaa-aa6d-6bb9bd38aaaa";
  const conventionDraft: ConventionDraftDto = {
    id: conventionDraftId,
    internshipKind: "immersion",
  };

  const conventionDraftStateInitial: ConventionDraftState = {
    isLoading: false,
    conventionDraft: null,
  };

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("Fetch convention draft", () => {
    it("fetches a convention draft successfully", () => {
      expectConventionDraftState(conventionDraftStateInitial);

      store.dispatch(
        conventionDraftSlice.actions.fetchConventionDraftRequested({
          conventionDraftId,
          feedbackTopic: "convention-draft",
        }),
      );

      expectConventionDraftState({
        isLoading: true,
        conventionDraft: null,
      });

      dependencies.conventionGateway.conventionDraft$.next(conventionDraft);

      expectConventionDraftState({
        isLoading: false,
        conventionDraft,
      });
    });

    it("stores error when fetching convention draft fails", () => {
      const errorMessage = "Convention draft not found";

      expectConventionDraftState(conventionDraftStateInitial);

      store.dispatch(
        conventionDraftSlice.actions.fetchConventionDraftRequested({
          conventionDraftId,
          feedbackTopic: "convention-draft",
        }),
      );

      expectConventionDraftState({
        isLoading: true,
      });

      dependencies.conventionGateway.conventionDraft$.error(
        new Error(errorMessage),
      );

      expectConventionDraftState(conventionDraftStateInitial);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-draft"],
        {
          level: "error",
          message: errorMessage,
          on: "fetch",
          title: "Problème lors de la récupération du brouillon de convention",
        },
      );
    });
  });

  describe("Clear fetched convention draft", () => {
    it("resets the convention draft state", () => {
      store.dispatch(
        conventionDraftSlice.actions.fetchConventionDraftRequested({
          conventionDraftId,
          feedbackTopic: "convention-draft",
        }),
      );
      dependencies.conventionGateway.conventionDraft$.next(conventionDraft);
      expectConventionDraftState({
        isLoading: false,
        conventionDraft: conventionDraft,
      });

      store.dispatch(
        conventionDraftSlice.actions.clearFetchedConventionDraft(),
      );

      expectConventionDraftState(conventionDraftStateInitial);
    });
  });

  describe("save convention draft", () => {
    it("fetches convention draft successfully before sharing", () => {
      expectConventionDraftState(conventionDraftStateInitial);

      store.dispatch(
        conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
          senderEmail: "sender@example.com",
          recipientEmail: "recipient@example.com",
          mode: "share",
          conventionDraft,
          feedbackTopic: "convention-draft",
        }),
      );

      expectConventionDraftState({
        isLoading: true,
        conventionDraft: null,
      });

      dependencies.conventionGateway.saveConventionDraftResult$.next();

      expectConventionDraftState(conventionDraftStateInitial);
      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-draft"],
        {
          level: "success",
          message: "Ce brouillon a bien été partagé par mail.",
          on: "create",
          title: "Partager ou enregistrer un brouillon",
        },
      );
    });

    it("handles error when fetching convention draft fails before sharing", () => {
      const errorMessage = "Erreur lors de l'envoi de l'email";

      expectConventionDraftState(conventionDraftStateInitial);

      store.dispatch(
        conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
          senderEmail: "sender@example.com",
          recipientEmail: "recipient@example.com",
          mode: "share",
          conventionDraft,
          feedbackTopic: "convention-draft",
        }),
      );

      expectConventionDraftState({
        isLoading: true,
        conventionDraft: null,
      });

      dependencies.conventionGateway.saveConventionDraftResult$.error(
        new Error(errorMessage),
      );

      expectConventionDraftState(conventionDraftStateInitial);

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["convention-draft"],
        {
          level: "error",
          message: errorMessage,
          on: "create",
          title: "Partager ou enregistrer un brouillon",
        },
      );
    });

    it("redirects to the given URL on success when redirectUrl is provided", () => {
      const redirectUrl: AbsoluteUrl = "https://example.com/redirect";

      store.dispatch(
        conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
          senderEmail: "sender@example.com",
          recipientEmail: "recipient@example.com",
          conventionDraft,
          mode: "share",
          redirectUrl,
          feedbackTopic: "convention-draft",
        }),
      );

      dependencies.conventionGateway.saveConventionDraftResult$.next();

      expectToEqual(
        (dependencies.navigationGateway as InMemoryNavigationGateway)
          .wentToUrls,
        [redirectUrl],
      );
    });

    it("does not redirect on success when no redirectUrl is provided", () => {
      store.dispatch(
        conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
          senderEmail: "sender@example.com",
          recipientEmail: "recipient@example.com",
          mode: "share",
          conventionDraft,
          feedbackTopic: "convention-draft",
        }),
      );

      dependencies.conventionGateway.saveConventionDraftResult$.next();

      expectToEqual(
        (dependencies.navigationGateway as InMemoryNavigationGateway)
          .wentToUrls,
        [],
      );
    });

    it("does not redirect when the request fails", () => {
      const redirectUrl: AbsoluteUrl = "https://example.com/redirect";

      store.dispatch(
        conventionDraftSlice.actions.saveConventionDraftThenRedirectRequested({
          senderEmail: "sender@example.com",
          recipientEmail: "recipient@example.com",
          mode: "share",
          conventionDraft,
          redirectUrl,
          feedbackTopic: "convention-draft",
        }),
      );

      dependencies.conventionGateway.saveConventionDraftResult$.error(
        new Error("some error"),
      );

      expectToEqual(
        (dependencies.navigationGateway as InMemoryNavigationGateway)
          .wentToUrls,
        [],
      );
    });
  });

  const expectConventionDraftState = (
    conventionDraftState: Partial<ConventionDraftState>,
  ) => {
    expectObjectsToMatch(
      store.getState().conventionDraft,
      conventionDraftState,
    );
  };
});
