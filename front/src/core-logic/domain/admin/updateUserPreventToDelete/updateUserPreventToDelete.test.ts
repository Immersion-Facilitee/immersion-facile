import { ConnectedUserBuilder, expectToEqual } from "shared";
import { adminPreloadedState } from "src/core-logic/domain/admin/adminPreloadedState";
import { updateUserPreventToDeleteSelectors } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.selectors";
import { updateUserPreventToDeleteSlice } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.slice";
import { feedbacksSelectors } from "src/core-logic/domain/feedback/feedback.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("UpdateUserPreventToDelete slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const user = new ConnectedUserBuilder()
    .withId("user-id")
    .withPreventToDelete(false)
    .build();
  const errorMessage =
    "Une erreur est survenue lors de la mise à jour de l'utilisateur.";

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      admin: adminPreloadedState({
        fetchUser: {
          user,
          isFetching: false,
        },
      }),
    }));
  });

  it("updates preventToDelete successfully and stores the feedback", () => {
    store.dispatch(
      updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteRequested(
        {
          userId: user.id,
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        },
      ),
    );

    expectToEqual(
      updateUserPreventToDeleteSelectors.isLoading(store.getState()),
      true,
    );

    dependencies.adminGateway.updateUserPreventToDeleteResponse$.next(
      undefined,
    );

    expectToEqual(
      updateUserPreventToDeleteSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["user-prevent-to-delete"],
      {
        level: "success",
        title: "L'utilisateur a été mis à jour",
        message: "La modification a bien été prise en compte.",
        on: "update",
      },
    );
  });

  it("does not update preventToDelete if error, and stores the feedback", () => {
    store.dispatch(
      updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteRequested(
        {
          userId: user.id,
          preventToDelete: true,
          feedbackTopic: "user-prevent-to-delete",
        },
      ),
    );

    expectToEqual(
      updateUserPreventToDeleteSelectors.isLoading(store.getState()),
      true,
    );

    dependencies.adminGateway.updateUserPreventToDeleteResponse$.error(
      new Error(errorMessage),
    );

    expectToEqual(
      updateUserPreventToDeleteSelectors.isLoading(store.getState()),
      false,
    );
    expectToEqual(
      feedbacksSelectors.feedbacks(store.getState())["user-prevent-to-delete"],
      {
        level: "error",
        message: errorMessage,
        on: "update",
        title: "Problème lors de la mise à jour de l'utilisateur",
      },
    );
  });
});
