import { type BroadcastFeedback, expectToEqual } from "shared";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { feedbacksSelectors } from "../feedback/feedback.selectors";
import {
  type PartnersErroredConventionState,
  partnersErroredConventionSlice,
} from "./partnersErroredConvention.slice";

describe("Agency info in store", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const fakeConventionId = "add5c20e-6dd2-45af-affe-927358005251";
  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("should switch isLoading to true when mark as handled is requested", () => {
    store.dispatch(
      partnersErroredConventionSlice.actions.markAsHandledRequested({
        jwt: "my-jwt",
        markAsHandledParams: { conventionId: fakeConventionId },
        feedbackTopic: "partner-conventions",
      }),
    );
    expectIsLoadingToBe(true);
  });

  it("should set feedbackKind as mark as handled when mark as handled succesfull", () => {
    store.dispatch(
      partnersErroredConventionSlice.actions.markAsHandledRequested({
        jwt: "my-jwt",
        markAsHandledParams: { conventionId: fakeConventionId },
        feedbackTopic: "partner-conventions",
      }),
    );
    dependencies.conventionGateway.markPartnersErroredConventionAsHandledResult$.next();

    expectIsLoadingToBe(false);
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "partner-conventions": {
        on: "update",
        level: "success",
        title: "La convention a bien été marquée comme traitée",
        message: "La convention a bien été marquée comme traitée.",
      },
    });
  });

  it("should throw an error when something goes wrong", () => {
    const errorMessage = "Error trying to mark error convention as handled";
    store.dispatch(
      partnersErroredConventionSlice.actions.markAsHandledRequested({
        jwt: "my-jwt",
        markAsHandledParams: { conventionId: fakeConventionId },
        feedbackTopic: "partner-conventions",
      }),
    );

    dependencies.conventionGateway.markPartnersErroredConventionAsHandledResult$.error(
      new Error(errorMessage),
    );

    expectIsLoadingToBe(false);
    expectToEqual(feedbacksSelectors.feedbacks(store.getState()), {
      "partner-conventions": {
        on: "update",
        level: "error",
        title: "Problème rencontré",
        message: errorMessage,
      },
    });
  });

  const expectIsLoadingToBe = (
    expected: PartnersErroredConventionState["isLoading"],
  ) =>
    expect(store.getState().partnersErroredConvention.isLoading).toBe(expected);
});

describe("Broadcast feedback in store", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const fakeConventionId = "add5c20e-6dd2-45af-affe-927358005251";
  const fakeJwt = "my-jwt";

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("should switch isLoading to true when fetch last broadcast feedback is requested", () => {
    store.dispatch(
      partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackRequested(
        {
          conventionId: fakeConventionId,
          jwt: fakeJwt,
        },
      ),
    );
    expectIsLoadingToBe(true);
  });

  it("should set lastBroadcastFeedback when fetch last broadcast feedback succeeds", () => {
    const mockBroadcastFeedback: BroadcastFeedback = {
      serviceName: "test-service",
      consumerId: "consumer-1",
      consumerName: "Test Consumer",
      conventionId: fakeConventionId,
      agencyId: "any-agency-id",
      requestParams: {
        conventionId: fakeConventionId,
      },
      occurredAt: new Date("2023-01-01").toDateString(),
      handledByAgency: false,
    };

    store.dispatch(
      partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackRequested(
        {
          conventionId: fakeConventionId,
          jwt: fakeJwt,
        },
      ),
    );
    dependencies.conventionGateway.getConventionLastBroadcastFeedbackResult$.next(
      {
        lastBroadcastFeedback: mockBroadcastFeedback,
        shouldBeHandled: false,
      },
    );

    expectIsLoadingToBe(false);
    expect(
      store.getState().partnersErroredConvention.lastBroadcastFeedback,
    ).toEqual(mockBroadcastFeedback);
  });

  it("should set lastBroadcastFeedback to null when fetch last broadcast feedback succeeds with null", () => {
    store.dispatch(
      partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackRequested(
        {
          conventionId: fakeConventionId,
          jwt: fakeJwt,
        },
      ),
    );
    dependencies.conventionGateway.getConventionLastBroadcastFeedbackResult$.next(
      {
        lastBroadcastFeedback: null,
      },
    );

    expectIsLoadingToBe(false);
    expect(
      store.getState().partnersErroredConvention.lastBroadcastFeedback,
    ).toBeNull();
  });

  it("should handle error when fetch last broadcast feedback fails", () => {
    const errorMessage = "Error fetching last broadcast feedback";

    store.dispatch(
      partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackRequested(
        {
          conventionId: fakeConventionId,
          jwt: fakeJwt,
        },
      ),
    );
    dependencies.conventionGateway.getConventionLastBroadcastFeedbackResult$.error(
      new Error(errorMessage),
    );

    expectIsLoadingToBe(false);

    expect(
      store.getState().partnersErroredConvention.lastBroadcastFeedback,
    ).toBeNull();
  });

  it("should clear lastBroadcastFeedback when clearLastBroadcastFeedback is dispatched", () => {
    const broadcastFeedback: BroadcastFeedback = {
      serviceName: "test-service",
      consumerId: "consumer-1",
      consumerName: "Test Consumer",
      conventionId: fakeConventionId,
      agencyId: "any-agency-id",
      requestParams: {
        conventionId: fakeConventionId,
      },
      occurredAt: new Date("2023-01-01").toDateString(),
      handledByAgency: false,
    };

    store.dispatch(
      partnersErroredConventionSlice.actions.fetchConventionLastBroadcastFeedbackRequested(
        {
          conventionId: fakeConventionId,
          jwt: fakeJwt,
        },
      ),
    );
    dependencies.conventionGateway.getConventionLastBroadcastFeedbackResult$.next(
      {
        lastBroadcastFeedback: broadcastFeedback,
        shouldBeHandled: false,
      },
    );

    expect(
      store.getState().partnersErroredConvention.lastBroadcastFeedback,
    ).toEqual(broadcastFeedback);

    store.dispatch(
      partnersErroredConventionSlice.actions.clearConventionLastBroadcastFeedback(),
    );

    expect(
      store.getState().partnersErroredConvention.lastBroadcastFeedback,
    ).toBeNull();
  });

  const expectIsLoadingToBe = (
    expected: PartnersErroredConventionState["isLoading"],
  ) =>
    expect(store.getState().partnersErroredConvention.isLoading).toBe(expected);
});
