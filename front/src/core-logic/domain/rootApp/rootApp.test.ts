import { expectToEqual } from "shared";
import { rootAppSlice } from "src/core-logic/domain/rootApp/rootApp.slice";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore, RootState } from "src/core-logic/storeConfig/store";

describe("rootApp epic", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("should reset the app store", () => {
    const afterReadyStoreState: RootState = {
      ...store.getState(),
      auth: {
        isRequestingLoginByEmail: false,
        isLoading: false,
        isRequestingRenewExpiredJwt: false,
        afterLoginRedirectionUrl: null,
        federatedIdentity: null,
        requestedEmail: null,
      },
    };

    store.dispatch(
      searchSlice.actions.getOffersRequested({
        distanceKm: 10,
        longitude: 0,
        latitude: 0,
        appellationCodes: ["11000"],
        sortBy: "distance",
        sortOrder: "desc",
        place: "23 rue lunaire, 44000 Nantes",
        fitForDisabledWorkers: undefined,
      }),
    );
    expect(store.getState()).not.toEqual(afterReadyStoreState);

    store.dispatch(rootAppSlice.actions.appResetRequested());

    expectToEqual(store.getState(), afterReadyStoreState);
  });

  it("should dispatch appIsReady action", () => {
    const token = "my-super-token";
    dependencies.localDeviceRepository.set("federatedIdentity", {
      provider: "proConnect",
      token,
    });

    expect(store.getState().auth.federatedIdentity).toBeNull();

    store.dispatch(rootAppSlice.actions.appResetRequested());

    expect(store.getState().auth.federatedIdentity?.token).toBe(token);
  });
});
