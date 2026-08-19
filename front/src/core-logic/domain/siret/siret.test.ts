import {
  type GetSiretEstablishmentDtoResponse,
  type SiretEstablishmentDto,
  type SupportedCountryCode,
  tooManySirenRequestsSiretErrorMessage,
} from "shared";
import { siretSelectors } from "src/core-logic/domain/siret/siret.selectors";
import {
  type SiretSliceError,
  type SiretState,
  siretSlice,
} from "src/core-logic/domain/siret/siret.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";

describe("Siret validation and fetching", () => {
  const establishmentFetched: SiretEstablishmentDto = {
    siret: "11110000111100",
    businessName: "Existing open business on Sirene Corp.",
    businessAddress: "2 avenue Karl Marx, 75018 Paris",
    isOpen: true,
    numberEmployeesRange: "",
    isAlreadySaved: false,
  };

  const foreignEstablishmentFetched: SiretEstablishmentDto = {
    siret: "94127100900016",
    businessName: "Kevin SIEMENS (SIEMENS)",
    businessAddress: "20 A KRONENSTRASSE, 30161 HANNOVER, ALLEMAGNE",
    isOpen: true,
    numberEmployeesRange: "",
    isAlreadySaved: false,
  };

  let store: ReduxStore;
  let dependencies: TestDependencies;

  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  describe("Siret validation", () => {
    it("updates current siret", () => {
      dispatchSiretModified("1111");
      expectCurrentSiretSelectorToBe("1111");
      expectIsSearchingSelectorToBe(false);
    });

    it("does not trigger search if some characters are not digit", () => {
      dispatchSiretModified("1111000011110A");
      expectIsSearchingSelectorToBe(false);
    });

    it("reflects error when siret contains letters", () => {
      dispatchSiretModified("111AAAA");
      expectSiretErrorSelectorToBe("SIRET must be 14 digits");
      expectIsSearchingSelectorToBe(false);
    });

    it("reflects error when siret is not the correct length", () => {
      dispatchSiretModified("11110000");
      expectIsSearchingSelectorToBe(false);
      expectSiretErrorSelectorToBe("SIRET must be 14 digits");
    });

    it("triggers search when siret reaches 14 digit", () => {
      dispatchSiretModified("11110000111100");
      expectIsSearchingSelectorToBe(true);
    });

    it("triggers search when siret reaches 14 digits, even if there are white spaces", () => {
      dispatchSiretModified("1  111 0003 1111 00  ");
      expectIsSearchingSelectorToBe(true);
    });

    it("when the current siret is modified the establishments and api errors are dropped", () => {
      setStoreWithInitialSiretState({
        establishment: establishmentFetched,
        error: "Missing establishment on SIRENE API.",
      });

      dispatchSiretModified("111100001111");
      expectEstablishmentSelectorToEqual(null);
      expectSiretErrorSelectorToBe("SIRET must be 14 digits");
    });
  });

  describe("Siret fetching when a 14 digit siret is provided", () => {
    it("fetches correctly and keeps the returned establishment", () => {
      setStoreWithInitialSiretState({
        shouldThrowErrorOnAlreadySaved: true,
      });
      dispatchSiretModified("11110000111100");
      feedSirenGatewayThroughBackWith(establishmentFetched);
      expectEstablishmentSelectorToEqual(establishmentFetched);
      expectCountryCodeSelectorToBe("FR");
      expectOnly_getSiretEstablishmentDtoResponse_toHaveBeenCalled();
      expectCurrentSiretSelectorToBe("11110000111100");
    });

    it("fetches correctly foreign establishment and keeps the returned establishment and country code", () => {
      setStoreWithInitialSiretState({
        shouldThrowErrorOnAlreadySaved: true,
      });
      dispatchSiretModified("94127100900016");
      feedSirenGatewayThroughBackWith(foreignEstablishmentFetched);
      expectEstablishmentSelectorToEqual(foreignEstablishmentFetched);
      expectCountryCodeSelectorToBe("DE");
      expectOnly_getSiretEstablishmentDtoResponse_toHaveBeenCalled();
      expectCurrentSiretSelectorToBe("94127100900016");
    });

    it("fetches correctly establishment with default country code if country not found in its address", () => {
      const establishmentWithoutCountryInAddress: SiretEstablishmentDto = {
        siret: "94127100900016",
        businessName: "Existing business",
        businessAddress: "20 Av de de la République, Rhône",
        isOpen: true,
        numberEmployeesRange: "",
        isAlreadySaved: false,
      };

      setStoreWithInitialSiretState({
        shouldThrowErrorOnAlreadySaved: true,
      });
      dispatchSiretModified("94127100900016");
      feedSirenGatewayThroughBackWith(establishmentWithoutCountryInAddress);
      expectEstablishmentSelectorToEqual(establishmentWithoutCountryInAddress);
      expectCountryCodeSelectorToBe("FR");
      expectOnly_getSiretEstablishmentDtoResponse_toHaveBeenCalled();
      expectCurrentSiretSelectorToBe("94127100900016");
    });

    it("fetches correctly and keeps the returned error", () => {
      dispatchSiretModified("11110000111100");
      feedSirenGatewayThroughBackWith(tooManySirenRequestsSiretErrorMessage);
      expectSiretErrorSelectorToBe("Too many requests on SIRENE API.");
    });

    it("fetches correctly and keeps the handles unexpected error", () => {
      dispatchSiretModified("11110000111100");
      feedSirenGatewayThroughBackWithError(new Error("Oups ! Failed"));
      expectSiretErrorSelectorToBe("Oups ! Failed");
    });

    it("when 'withAlreadySavedCheck' is false, fetches correctly but calls the relevant route", () => {
      dispatchSiretModified("11110000111100");
      feedSirenGatewayThroughBackWith(establishmentFetched);
      expectEstablishmentSelectorToEqual(establishmentFetched);
      expectCountryCodeSelectorToBe("FR");
      expectOnly_getSiretEstablishmentDtoResponse_toHaveBeenCalled();
    });
  });

  describe("shouldThrowErrorOnAlreadySaved", () => {
    const alreadySavedEstablishment: SiretEstablishmentDto = {
      ...establishmentFetched,
      isAlreadySaved: true,
    };

    it("clears error and establishment, and calls siretModified with new toggle mode", () => {
      setStoreWithInitialSiretState({
        currentSiret: "10002000300040",
        error: "Already exists",
        establishment: { siret: "yolo" } as SiretEstablishmentDto,
      });
      expectShouldThrowErrorOnAlreadySavedSelectorToBe(false);
      store.dispatch(
        siretSlice.actions.setShouldThrowErrorOnAlreadySaved({
          shouldThrowErrorOnAlreadySaved: true,
          addressAutocompleteLocator: "convention-immersion-address",
        }),
      );
      expectShouldThrowErrorOnAlreadySavedSelectorToBe(true);
      expectSiretErrorSelectorToBe(null);
      expectEstablishmentSelectorToEqual(null);
      expectCountryCodeSelectorToBe(null);
      expectCurrentSiretSelectorToBe("10002000300040");
      store.dispatch(
        siretSlice.actions.setShouldThrowErrorOnAlreadySaved({
          shouldThrowErrorOnAlreadySaved: false,
          addressAutocompleteLocator: "convention-immersion-address",
        }),
      );
      expectShouldThrowErrorOnAlreadySavedSelectorToBe(false);
      expectIsSearchingSelectorToBe(true);
    });

    describe("when shouldThrowErrorOnAlreadySaved is false", () => {
      beforeEach(() => {
        setStoreWithInitialSiretState({
          shouldThrowErrorOnAlreadySaved: false,
        });
      });

      it("and fetched establishment is already saved, should not have error in selector", () => {
        expectShouldThrowErrorOnAlreadySavedSelectorToBe(false);
        dispatchSiretModified(alreadySavedEstablishment.siret);
        feedSirenGatewayThroughBackWith(alreadySavedEstablishment);

        expectSiretErrorSelectorToBe(null);
      });

      it("and fetched establishment is not already saved, should not have error in selector", () => {
        expectShouldThrowErrorOnAlreadySavedSelectorToBe(false);
        dispatchSiretModified(establishmentFetched.siret);
        feedSirenGatewayThroughBackWith(establishmentFetched);

        expectSiretErrorSelectorToBe(null);
      });
    });

    describe("when shouldThrowErrorOnAlreadySaved is true", () => {
      beforeEach(() => {
        setStoreWithInitialSiretState({
          shouldThrowErrorOnAlreadySaved: true,
        });
      });

      it("and fetched establishment is already saved, should have error in selector", () => {
        expectShouldThrowErrorOnAlreadySavedSelectorToBe(true);
        dispatchSiretModified(alreadySavedEstablishment.siret);
        feedSirenGatewayThroughBackWith(alreadySavedEstablishment);

        expectSiretErrorSelectorToBe("Already exists");
      });

      it("and fetched establishment is not already saved, should not have error in selector", () => {
        expectShouldThrowErrorOnAlreadySavedSelectorToBe(true);
        dispatchSiretModified(establishmentFetched.siret);
        feedSirenGatewayThroughBackWith(establishmentFetched);

        expectSiretErrorSelectorToBe(null);
      });
    });
  });

  describe("Clearing siret info", () => {
    it("clears siret info", () => {
      setStoreWithInitialSiretState({
        currentSiret: "10002000300040",
        error: "Already exist",
        establishment: { siret: "yolo" } as SiretEstablishmentDto,
      });
      store.dispatch(siretSlice.actions.siretInfoClearRequested());
      expectCurrentSiretSelectorToBe("");
      expectEstablishmentSelectorToEqual(null);
      expectSiretErrorSelectorToBe(null);
      expectCountryCodeSelectorToBe(null);
      expectIsSearchingSelectorToBe(false);
    });
  });

  const dispatchSiretModified = (siret: string) =>
    store.dispatch(
      siretSlice.actions.siretModified({
        siret,
        feedbackTopic: "siret-input",
        addressAutocompleteLocator: "convention-immersion-address",
      }),
    );

  const expectShouldThrowErrorOnAlreadySavedSelectorToBe = (
    expected: boolean,
  ) => {
    expect(
      siretSelectors.shouldThrowErrorOnAlreadySaved(store.getState()),
    ).toBe(expected);
  };

  const expectCurrentSiretSelectorToBe = (expected: string) => {
    expect(siretSelectors.currentSiret(store.getState())).toBe(expected);
  };

  const expectIsSearchingSelectorToBe = (expected: boolean) => {
    expect(siretSelectors.isFetching(store.getState())).toBe(expected);
  };

  const expectCountryCodeSelectorToBe = (
    expected: SupportedCountryCode | null,
  ) => {
    expect(siretSelectors.countryCode(store.getState())).toBe(expected);
  };

  const expectEstablishmentSelectorToEqual = (
    expected: SiretEstablishmentDto | null,
  ) => {
    expect(siretSelectors.establishmentInfos(store.getState())).toBe(expected);
  };

  const expectSiretErrorSelectorToBe = (expected: SiretSliceError | null) => {
    expect(siretSelectors.siretRawError(store.getState())).toBe(expected);
  };

  const feedSirenGatewayThroughBackWith = (
    response: GetSiretEstablishmentDtoResponse,
  ) => {
    dependencies.formCompletionGateway.getSiretEstablishmentDto$.next(response);
  };

  const feedSirenGatewayThroughBackWithError = (error: Error) => {
    dependencies.formCompletionGateway.getSiretEstablishmentDto$.error(error);
  };

  const expectOnly_getSiretEstablishmentDtoResponse_toHaveBeenCalled = () => {
    expect(
      dependencies.formCompletionGateway
        .getSiretEstablishmentDtoResponseCallCount,
    ).toBe(1);
  };

  const setStoreWithInitialSiretState = (siretState: Partial<SiretState>) => {
    ({ store, dependencies } = createTestStore({
      siret: {
        ...siretSlice.getInitialState(),
        ...siretState,
      },
    }));
  };
});
