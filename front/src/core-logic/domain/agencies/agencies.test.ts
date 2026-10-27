import {
  AgencyDtoBuilder,
  type AgencyOption,
  type AgencyPublicDisplayDto,
} from "shared";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import { type AgenciesState, agenciesSlice } from "./agencies.slice";

describe("Agencies in store", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const fakeAgencyId = "1111";
  const agencyOption: AgencyOption = {
    id: "0",
    name: "Agence de Bougoin",
    kind: "autre",
    status: "active",
    address: {
      streetNumberAndAddress: "",
      postcode: "75002",
      departmentCode: "75",
      city: "Paris",
    },
    refersToAgencyName: null,
  };

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("agency infos", () => {
    it("should switch isLoading to true when fetch agency info is requested", () => {
      store.dispatch(
        agenciesSlice.actions.fetchAgencyInfoRequested(fakeAgencyId),
      );
      expectIsLoadingToBe(true);
    });

    it("should store agency info when agency is fetched from agency id", () => {
      const agency = new AgencyDtoBuilder().build();

      store.dispatch(agenciesSlice.actions.fetchAgencyInfoRequested(agency.id));

      const expectedAgencyInfos: AgencyPublicDisplayDto = {
        id: agency.id,
        name: agency.name,
        kind: agency.kind,
        address: agency.address,
        position: agency.position,
        signature: agency.signature,
        agencySiret: agency.agencySiret,
        refersToAgency: null,
        logoUrl: agency.logoUrl,
      };
      dependencies.agencyGateway.agencyInfo$.next(expectedAgencyInfos);

      expectAgencyInfoToEqual(expectedAgencyInfos);
      expectIsLoadingToBe(false);
      expectFeedbackToEqual({
        kind: "agencyInfoFetched",
      });
    });

    it("should throw an error when something goes wrong", () => {
      const errorMessage = "Error trying to fetch agency info by ID";
      const expectedFeedback: AgenciesState["feedback"] = {
        kind: "errored",
        errorMessage,
      };
      store.dispatch(
        agenciesSlice.actions.fetchAgencyInfoRequested(fakeAgencyId),
      );

      dependencies.agencyGateway.agencyInfo$.error(new Error(errorMessage));

      expectIsLoadingToBe(false);
      expectAgencyInfoToEqual(agenciesSlice.getInitialState().details);
      expectFeedbackToEqual(expectedFeedback);
    });
  });

  describe("agency options", () => {
    it("agencies list should be initialState at start", () => {
      const expected: AgencyOption[] = [];
      expectOptionsToEqual(expected);
    });

    it("retrieves agencies from API by department code and store in state", () => {
      const departmentCode = "11";

      store.dispatch(
        agenciesSlice.actions.fetchAgencyOptionsRequested({ departmentCode }),
      );
      expectIsLoadingToBe(true);
      dependencies.agencyGateway.agencyOptions$.next([agencyOption]);

      expectIsLoadingToBe(false);
      expectFeedbackToEqual({ kind: "agencyOptionsFetched" });
      expectOptionsToEqual([agencyOption]);
    });

    it("clears agency options when fetch fails", () => {
      ({ store, dependencies } = createTestStore({
        agencies: {
          ...agenciesSlice.getInitialState(),
          options: [agencyOption],
        },
      }));
      expectOptionsToEqual([agencyOption]);

      const errorMessage = "Error fetching agency options";
      store.dispatch(
        agenciesSlice.actions.fetchAgencyOptionsRequested({
          departmentCode: "11",
        }),
      );
      dependencies.agencyGateway.agencyOptions$.error(new Error(errorMessage));

      expectIsLoadingToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });
      expectOptionsToEqual([]);
    });
  });

  describe("add agency", () => {
    it("add agency successfully & cleared", () => {
      // Arrange
      const agency = new AgencyDtoBuilder().withKind("cap-emploi").build();
      expectIsLoadingToBe(false);

      // Execute
      store.dispatch(agenciesSlice.actions.addAgencyRequested(agency));

      expectIsLoadingToBe(true);
      dependencies.agencyGateway.addAgencyResponse$.next(undefined);

      // Expect
      expectIsLoadingToBe(false);
      expectFeedbackToEqual({ kind: "agencyAdded" });

      store.dispatch(agenciesSlice.actions.addAgencyClearRequested());
      expectFeedbackToEqual({ kind: "idle" });
    });

    it("add 'other' agency successfully & cleared", () => {
      // Arrange
      const agency = new AgencyDtoBuilder().withKind("autre").build();
      expectIsLoadingToBe(false);

      // Execute
      store.dispatch(agenciesSlice.actions.addAgencyRequested(agency));

      expectIsLoadingToBe(true);
      dependencies.agencyGateway.addAgencyResponse$.next(undefined);

      // Expect
      expectIsLoadingToBe(false);
      expectFeedbackToEqual({ kind: "agencyOfTypeOtherAdded" });

      store.dispatch(agenciesSlice.actions.addAgencyClearRequested());
      expectFeedbackToEqual({ kind: "idle" });
    });

    it("add agency failed & cleared", () => {
      // Arrange
      const agency = new AgencyDtoBuilder().build();
      expectIsLoadingToBe(false);

      // Execute
      store.dispatch(agenciesSlice.actions.addAgencyRequested(agency));

      expectIsLoadingToBe(true);
      const errorMessage = "Add agency failed.";
      dependencies.agencyGateway.addAgencyResponse$.error(
        new Error(errorMessage),
      );

      // Expect
      expectIsLoadingToBe(false);
      expectFeedbackToEqual({ kind: "errored", errorMessage });

      store.dispatch(agenciesSlice.actions.addAgencyClearRequested());
      expectFeedbackToEqual({ kind: "idle" });
    });
  });

  const expectIsLoadingToBe = (expected: AgenciesState["isLoading"]) =>
    expect(agenciesSelectors.agencies(store.getState()).isLoading).toBe(
      expected,
    );

  const expectAgencyInfoToEqual = (expected: AgenciesState["details"]) =>
    expect(agenciesSelectors.agencies(store.getState()).details).toEqual(
      expected,
    );

  const expectFeedbackToEqual = (expected: AgenciesState["feedback"]) =>
    expect(agenciesSelectors.agencies(store.getState()).feedback).toEqual(
      expected,
    );

  const expectOptionsToEqual = (expected: AgenciesState["options"]) =>
    expect(agenciesSelectors.agencies(store.getState()).options).toEqual(
      expected,
    );
});
