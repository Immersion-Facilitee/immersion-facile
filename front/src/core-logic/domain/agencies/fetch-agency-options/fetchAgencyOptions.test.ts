import { type AgencyOption, expectToEqual } from "shared";
import { fetchAgencyOptionsSelectors } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.selectors";
import {
  type FetchAgencyOptionsState,
  fetchAgencyOptionsInitialState,
  fetchAgencyOptionsSlice,
} from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("agencyAdmin", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore({
      fetchAgencyOptions: fetchAgencyOptionsInitialState,
    }));
  });

  describe("Agency update", () => {
    describe("Agency autocomplete", () => {
      it("shows when search is onGoing", () => {
        store.dispatch(
          fetchAgencyOptionsSlice.actions.fetchAgencyOptionsRequested("agen"),
        );
        expectIsLoadingToBe(true);
      });

      it("does not trigger call api before debounce time is reached, then triggers search and gets results", () => {
        const searchedText = "agen";
        store.dispatch(
          fetchAgencyOptionsSlice.actions.fetchAgencyOptionsRequested(
            searchedText,
          ),
        );
        expectIsLoadingToBe(true);
        fastForwardObservables();
        expectIsLoadingToBe(true);
        const agencies: AgencyOption[] = [
          {
            id: "my-id",
            name: "My agency",
            kind: "cap-emploi",
            status: "active",
            address: {
              streetNumberAndAddress: "",
              postcode: "75002",
              departmentCode: "75",
              city: "Paris",
            },
            refersToAgencyName: null,
          },
        ];
        feedWithAgencyOptions(agencies);
        expectAgencyAdminStateToMatch({
          isLoading: false,
          agencyOptions: agencies,
        });
      });
    });
  });

  const expectAgencyAdminStateToMatch = (
    params: Partial<FetchAgencyOptionsState>,
  ) => {
    expectToEqual(
      fetchAgencyOptionsSelectors.agencyOptions(store.getState()),
      params.agencyOptions,
    );
  };

  const expectIsLoadingToBe = (isLoading: boolean) =>
    expect(fetchAgencyOptionsSelectors.isLoading(store.getState())).toBe(
      isLoading,
    );

  const fastForwardObservables = () => dependencies.scheduler.flush();

  const feedWithAgencyOptions = (agencyOptions: AgencyOption[]) => {
    dependencies.agencyGateway.agencyOptions$.next(agencyOptions);
  };
});
