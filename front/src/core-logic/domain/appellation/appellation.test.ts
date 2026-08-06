import {
  type AppellationAndRomeDto,
  type AppellationDto,
  expectArraysToEqual,
  expectObjectsToMatch,
  expectToEqual,
} from "shared";
import { makeAppellationLocatorSelector } from "src/core-logic/domain/appellation/appellation.selectors";
import {
  type AutocompleteItem,
  initialAutocompleteItem,
} from "src/core-logic/domain/autocomplete.utils";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  type AppellationAutocompleteLocator,
  appellationSlice,
  type MultipleAppellationAutocompleteLocator,
} from "./appellation.slice";

describe("Appellation epic", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const locator: AppellationAutocompleteLocator = "search-form-appellation";
  const anotherLocator: AppellationAutocompleteLocator =
    "convention-profession";
  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("should reset the value and suggestions when the field is cleared", () => {
    store.dispatch(
      appellationSlice.actions.selectSuggestionRequested({
        locator,
        item: {
          appellationCode: "12345",
          appellationLabel: "Test Appellation",
          romeCode: "A1234",
          romeLabel: "Test Rome",
        },
      }),
    );
    store.dispatch(
      appellationSlice.actions.clearLocatorDataRequested({ locator }),
    );
    expect(store.getState().appellation.data[locator]?.value).toBeNull();
    expect(store.getState().appellation.data[locator]?.suggestions).toEqual([]);
  });

  const multipleAppellationData: Record<
    MultipleAppellationAutocompleteLocator,
    AutocompleteItem<AppellationAndRomeDto>
  > = {
    "multiple-appellation-0": {
      ...initialAutocompleteItem,
      value: {
        appellationCode: "12345",
        appellationLabel: "Test Appellation 1",
        romeCode: "A1111",
        romeLabel: "Test Rome 1",
      },
    },
    "multiple-appellation-1": {
      ...initialAutocompleteItem,
      value: {
        appellationCode: "12345",
        appellationLabel: "Test Appellation 2",
        romeCode: "A2222",
        romeLabel: "Test Rome 2",
      },
    },
    "multiple-appellation-2": {
      ...initialAutocompleteItem,
      value: {
        appellationCode: "12345",
        appellationLabel: "Test Appellation 3",
        romeCode: "A3333",
        romeLabel: "Test Rome 3",
      },
    },
    "multiple-appellation-3": {
      ...initialAutocompleteItem,
      value: {
        appellationCode: "12345",
        appellationLabel: "Test Appellation 4",
        romeCode: "A4444",
        romeLabel: "Test Rome 4",
      },
    },
  };
  const expectedData1: Record<
    MultipleAppellationAutocompleteLocator,
    AutocompleteItem<AppellationAndRomeDto>
  > = {
    "multiple-appellation-0": multipleAppellationData["multiple-appellation-0"],
    "multiple-appellation-1": multipleAppellationData["multiple-appellation-2"],
    "multiple-appellation-2": multipleAppellationData["multiple-appellation-3"],
  };
  const expectedData2: Record<
    MultipleAppellationAutocompleteLocator,
    AutocompleteItem<AppellationAndRomeDto>
  > = {
    "multiple-appellation-0": multipleAppellationData["multiple-appellation-1"],
    "multiple-appellation-1": multipleAppellationData["multiple-appellation-2"],
    "multiple-appellation-2": multipleAppellationData["multiple-appellation-3"],
  };
  const expectedData3: Record<
    MultipleAppellationAutocompleteLocator,
    AutocompleteItem<AppellationAndRomeDto>
  > = {
    "multiple-appellation-0": multipleAppellationData["multiple-appellation-0"],
    "multiple-appellation-1": multipleAppellationData["multiple-appellation-1"],
    "multiple-appellation-2": multipleAppellationData["multiple-appellation-2"],
  };
  it.each([
    {
      description: "removing a middle element (locator1)",
      locatorToRemove: "multiple-appellation-1",
      expectedData: expectedData1,
    },
    {
      description: "removing the first element (locator0)",
      locatorToRemove: "multiple-appellation-0",
      expectedData: expectedData2,
    },
    {
      description: "removing the last element (locator3)",
      locatorToRemove: "multiple-appellation-3",
      expectedData: expectedData3,
    },
  ])("should handle $description", ({ locatorToRemove, expectedData }) => {
    const { store } = createTestStore({
      appellation: { data: multipleAppellationData },
    });

    store.dispatch(
      appellationSlice.actions.clearLocatorDataRequested({
        locator: locatorToRemove as MultipleAppellationAutocompleteLocator,
        multiple: true,
      }),
    );

    expectToEqual(store.getState().appellation.data, expectedData);
  });

  it("should update the searched query and reset the state", () => {
    const query = "test";
    store.dispatch(
      appellationSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectDebouncingToBe(false);
    expectLoadingToBe(true);
    expectQueryToBe(query);
  });

  it("shouldn't update the searched query if threshold is not reached", () => {
    const query = "te";
    store.dispatch(
      appellationSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectLoadingToBe(false);
    expectQueryToBe("");
  });

  it("should trigger a new request to the gateway when query > threshold", () => {
    const query = "Test";
    const expectedSuggestions: AppellationAndRomeDto[] = [
      {
        appellationCode: "12345",
        appellationLabel: "Test Appellation",
        romeCode: "A1234",
        romeLabel: "Test Rome",
      },
    ];
    store.dispatch(
      appellationSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectDebouncingToBe(false);
    expectLoadingToBe(true);
    dependencies.formCompletionGateway.appellationDtoMatching$.next(
      expectedSuggestions,
    );
    expectLoadingToBe(false);
    expectSuggestionsToBe(expectedSuggestions);
  });

  it("should keep selected suggestion in store when selecting another suggestion", () => {
    const previouslySelectedSuggestion: AppellationAndRomeDto = {
      appellationCode: "12345",
      appellationLabel: "Test Appellation",
      romeCode: "A1234",
      romeLabel: "Test Rome",
    };

    store.dispatch(
      appellationSlice.actions.selectSuggestionRequested({
        item: previouslySelectedSuggestion,
        locator,
      }),
    );
    const newSelectedSuggestion: AppellationAndRomeDto = {
      appellationCode: "12345",
      appellationLabel: "Test Appellation",
      romeCode: "A1234",
      romeLabel: "Test Rome",
    };
    store.dispatch(
      appellationSlice.actions.selectSuggestionRequested({
        item: newSelectedSuggestion,
        locator: anotherLocator,
      }),
    );
    expectSelectedSuggestionToBe(previouslySelectedSuggestion);
    expectToEqual(
      makeAppellationLocatorSelector(anotherLocator)(store.getState())?.value,
      newSelectedSuggestion,
    );
  });

  it("should update selected suggestion in store", () => {
    const appellation: AppellationDto = {
      appellationCode: "12345",
      appellationLabel: "Test Appellation",
    };
    const expected: AppellationAndRomeDto = {
      ...appellation,
      romeCode: "A1234",
      romeLabel: "Test Rome",
    };
    store.dispatch(
      appellationSlice.actions.selectSuggestionRequested({
        locator,
        item: expected,
      }),
    );
    expectSelectedSuggestionToBe(expected);
  });

  it("should throw an error if something goes wrong and returns error feedback", () => {
    const errorMessage = "Error trying to get appellation";
    store.dispatch(
      appellationSlice.actions.fetchSuggestionsRequested({
        locator,
        lookup: "test",
      }),
    );
    dependencies.formCompletionGateway.appellationDtoMatching$.error(
      new Error(errorMessage),
    );
    expectLoadingToBe(false);
  });

  const expectQueryToBe = (expected: string) => {
    expectToEqual(
      makeAppellationLocatorSelector(locator)(store.getState())?.query,
      expected,
    );
  };
  const expectLoadingToBe = (expected: boolean) => {
    expectToEqual(
      makeAppellationLocatorSelector(locator)(store.getState())?.isLoading,
      expected,
    );
  };
  const expectDebouncingToBe = (expected: boolean) => {
    expectToEqual(
      makeAppellationLocatorSelector(locator)(store.getState())?.isDebouncing,
      expected,
    );
  };
  const expectSuggestionsToBe = (expected: AppellationAndRomeDto[]) => {
    expectArraysToEqual(
      makeAppellationLocatorSelector(locator)(store.getState())?.suggestions ??
        [],
      expected,
    );
  };
  const expectSelectedSuggestionToBe = (expected: AppellationAndRomeDto) => {
    expectObjectsToMatch(
      makeAppellationLocatorSelector(locator)(store.getState())?.value,
      expected,
    );
  };
});
