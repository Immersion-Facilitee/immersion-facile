import {
  expectToEqual,
  type UserWithNumberOfAgenciesAndEstablishments,
} from "shared";
import { listUsersSelectors } from "src/core-logic/domain/admin/listUsers/listUsers.selectors";
import { listUsersSlice } from "src/core-logic/domain/admin/listUsers/listUsers.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

const someUser: UserWithNumberOfAgenciesAndEstablishments = {
  id: "some-user-id",
  email: "yolo@mail.com",
  firstName: "Yo",
  lastName: "Lo",
  proConnect: {
    externalId: "external-123",
    siret: "00000000005555",
  },
  createdAt: new Date().toISOString(),
  preventToDelete: false,
  numberOfAgencies: 2,
  numberOfEstablishments: 1,
};

describe("Admin Users slice", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("updates the query", () => {
    const query = "my query";
    store.dispatch(listUsersSlice.actions.queryUpdated(query));
    expectToEqual(listUsersSelectors.query(store.getState()), query);
  });

  it("fetches users successfully", () => {
    expectToEqual(listUsersSelectors.isFetching(store.getState()), false);
    expectToEqual(listUsersSelectors.users(store.getState()), []);

    store.dispatch(
      listUsersSlice.actions.fetchUsersRequested({ emailContains: "yo" }),
    );

    expectToEqual(listUsersSelectors.isFetching(store.getState()), true);

    feedWithUsers([someUser]);

    expectToEqual(listUsersSelectors.isFetching(store.getState()), false);
    expectToEqual(listUsersSelectors.users(store.getState()), [someUser]);
  });

  it("triggers fetch when query value changes, but not before 400 ms", () => {
    const query = "my query";
    store.dispatch(listUsersSlice.actions.queryUpdated(query));
    expectToEqual(listUsersSelectors.isFetching(store.getState()), false);
    fastForwardObservables();
    expectToEqual(listUsersSelectors.isFetching(store.getState()), true);

    feedWithUsers([someUser]);
    expectToEqual(listUsersSelectors.isFetching(store.getState()), false);
    expectToEqual(listUsersSelectors.users(store.getState()), [someUser]);
  });

  const feedWithUsers = (
    users: UserWithNumberOfAgenciesAndEstablishments[],
  ) => {
    dependencies.adminGateway.listUsersResponse$.next(users);
  };

  const fastForwardObservables = () => dependencies.scheduler.flush();
});
