import { expectToEqual, type GroupInfo } from "shared";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import { groupSelectors } from "src/core-logic/domain/group/group.selectors";
import {
  groupSlice,
  initialState,
} from "src/core-logic/domain/group/group.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("group epic", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("fetch a group", () => {
    const expectedGroup: GroupInfo = {
      name: "qdsf",
      options: {
        heroHeader: {
          description: "",
          title: "",
        },
      },
      slug: "test-slug",
    };

    it("get the result successfully", () => {
      expectStateToMatchInitialState();

      expectIsLoading(false);

      store.dispatch(
        groupSlice.actions.getGroupRequested({
          slug: "test-slug",
          feedbackTopic: "group-page",
        }),
      );
      expectToEqual(
        groupSelectors.currentGroup(store.getState()),
        initialState.currentGroup,
      );
      expectIsLoading(true);
      dependencies.searchGateway.currentGroupInfo$.next(expectedGroup);
      expectIsLoading(false);
      expectToEqual(
        groupSelectors.currentGroup(store.getState()),
        expectedGroup,
      );
    });

    it("fail to get result", () => {
      expectStateToMatchInitialState();

      expectIsLoading(false);

      store.dispatch(
        groupSlice.actions.getGroupRequested({
          slug: "wrong-test-slug",
          feedbackTopic: "group-page",
        }),
      );
      expectToEqual(
        groupSelectors.currentGroup(store.getState()),
        initialState.currentGroup,
      );
      expectIsLoading(true);

      dependencies.searchGateway.currentGroupInfo$.error(
        new Error("Bad request"),
      );

      expectToEqual(
        feedbacksSelectors.feedbacks(store.getState())["group-page"],
        {
          on: "fetch",
          level: "error",
          message: "Bad request",
          title: "Une erreur s'est produite",
        },
      );
      expectIsLoading(false);
      expectToEqual(
        groupSelectors.currentGroup(store.getState()),
        initialState.currentGroup,
      );
    });
  });

  const expectStateToMatchInitialState = () => {
    expectToEqual(store.getState().group, initialState);
  };

  const expectIsLoading = (isLoading: boolean) =>
    expect(groupSelectors.isLoading(store.getState())).toBe(isLoading);
});
