import {
  type AddressAndPositionWithFormattedAddress,
  type AddressWithCountryCodeAndPosition,
  AgencyDtoBuilder,
  addressDtoToString,
  defaultCountryCode,
  expectArraysToEqual,
  expectObjectsToMatch,
  expectToEqual,
} from "shared";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import {
  type AutocompleteItem,
  type AutocompleteState,
  initialAutocompleteItem,
} from "src/core-logic/domain/autocomplete.utils";
import { makeGeocodingLocatorSelector } from "src/core-logic/domain/geocoding/geocoding.selectors";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import {
  createTestStore,
  type TestDependencies,
} from "src/core-logic/storeConfig/createTestStore";
import type { ReduxStore } from "src/core-logic/storeConfig/store";
import {
  type AddressAutocompleteLocator,
  geocodingSlice,
  type MultipleAddressAutocompleteLocator,
} from "./geocoding.slice";

describe("Geocoding epic", () => {
  let store: ReduxStore;
  let dependencies: TestDependencies;
  const locator: AddressAutocompleteLocator = "convention-immersion-address";
  const anotherLocator: AddressAutocompleteLocator =
    "convention-beneficiary-address";
  beforeEach(() => {
    ({ store, dependencies } = createTestStore());
  });

  it("should reset the value and suggestions when the field is cleared", () => {
    store.dispatch(
      geocodingSlice.actions.selectSuggestionRequested({
        item: {
          address: {
            city: "Paris",
            departmentCode: "75",
            postcode: "75000",
            streetNumberAndAddress: "123 Rue de la Paix",
            countryCode: defaultCountryCode,
          },
          position: {
            lat: 48.8566,
            lon: 2.3522,
          },
        },
        locator,
      }),
    );
    store.dispatch(
      geocodingSlice.actions.clearLocatorDataRequested({ locator }),
    );
    expect(store.getState().geocoding.data[locator]?.value).toBeNull();
    expect(store.getState().geocoding.data[locator]?.suggestions).toEqual([]);
  });

  const multipleAddressData: Record<
    MultipleAddressAutocompleteLocator,
    AutocompleteItem<AddressWithCountryCodeAndPosition>
  > = {
    "multiple-address-0": {
      ...initialAutocompleteItem,
      value: {
        address: {
          city: "Paris",
          departmentCode: "75",
          postcode: "75018",
          streetNumberAndAddress: "254 Avenue Maxime Gorki",
          countryCode: defaultCountryCode,
        },
        position: { lat: 48.8566, lon: 2.3522 },
      },
    },
    "multiple-address-1": {
      ...initialAutocompleteItem,
      value: {
        address: {
          city: "Poitiers",
          departmentCode: "86",
          postcode: "86000",
          streetNumberAndAddress: "254 Rue de la Paix",
          countryCode: defaultCountryCode,
        },
        position: { lat: 46.5833, lon: 0.3333 },
      },
    },
    "multiple-address-2": {
      ...initialAutocompleteItem,
      value: {
        address: {
          city: "Bordeaux",
          departmentCode: "33",
          postcode: "33000",
          streetNumberAndAddress: "25 rue des Chartrons",
          countryCode: defaultCountryCode,
        },
        position: { lat: 44.8378, lon: -0.5795 },
      },
    },
    "multiple-address-3": {
      ...initialAutocompleteItem,
      value: {
        address: {
          city: "Paris",
          departmentCode: "75",
          postcode: "75000",
          streetNumberAndAddress: "123 Rue de la Paix",
          countryCode: defaultCountryCode,
        },
        position: { lat: 48.8566, lon: 2.3522 },
      },
    },
  };
  const expectedData1: Record<
    MultipleAddressAutocompleteLocator,
    AutocompleteItem<AddressWithCountryCodeAndPosition>
  > = {
    "multiple-address-0": multipleAddressData["multiple-address-0"],
    "multiple-address-1": multipleAddressData["multiple-address-2"],
    "multiple-address-2": multipleAddressData["multiple-address-3"],
  };
  const expectedData2: Record<
    MultipleAddressAutocompleteLocator,
    AutocompleteItem<AddressWithCountryCodeAndPosition>
  > = {
    "multiple-address-0": multipleAddressData["multiple-address-1"],
    "multiple-address-1": multipleAddressData["multiple-address-2"],
    "multiple-address-2": multipleAddressData["multiple-address-3"],
  };
  const expectedData3: Record<
    MultipleAddressAutocompleteLocator,
    AutocompleteItem<AddressWithCountryCodeAndPosition>
  > = {
    "multiple-address-0": multipleAddressData["multiple-address-0"],
    "multiple-address-1": multipleAddressData["multiple-address-1"],
    "multiple-address-2": multipleAddressData["multiple-address-2"],
  };
  const multipleAddressGeocodingData = multipleAddressData as AutocompleteState<
    AddressAutocompleteLocator,
    AddressAndPositionWithFormattedAddress
  >["data"];
  it.each([
    {
      description: "removing a middle element (locator1)",
      locatorToRemove: "multiple-address-1",
      expectedData: expectedData1,
    },
    {
      description: "removing the first element (locator0)",
      locatorToRemove: "multiple-address-0",
      expectedData: expectedData2,
    },
    {
      description: "removing the last element (locator3)",
      locatorToRemove: "multiple-address-3",
      expectedData: expectedData3,
    },
  ])("should handle $description", ({ locatorToRemove, expectedData }) => {
    const { store } = createTestStore({
      geocoding: { data: multipleAddressGeocodingData },
    });

    store.dispatch(
      geocodingSlice.actions.clearLocatorDataRequested({
        locator: locatorToRemove as MultipleAddressAutocompleteLocator,
        multiple: true,
      }),
    );

    expectToEqual(
      store.getState().geocoding.data,
      expectedData as typeof multipleAddressGeocodingData,
    );
  });

  it("should update the searched query and reset the state", () => {
    const query = "foi";
    store.dispatch(
      geocodingSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
        countryCode: defaultCountryCode,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectDebouncingToBe(false);
    expectLoadingToBe(true);
    expectQueryToBe(query);
  });

  it("shouldn't update the searched query if threshold is not reached", () => {
    const query = "fo";
    store.dispatch(
      geocodingSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
        countryCode: defaultCountryCode,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectLoadingToBe(false);
    expectQueryToBe("");
  });

  it("should trigger a new request to the gateway when query > threshold", () => {
    const query = "Poit";
    const expectedSuggestions: AddressAndPositionWithFormattedAddress[] = [
      {
        address: {
          city: "Saint-Georges-les-Baillargeaux",
          departmentCode: "86",
          postcode: "86110",
          streetNumberAndAddress: "123 Rue de la Paix",
          countryCode: defaultCountryCode,
        },
        position: {
          lat: 45.984,
          lon: 2.5465,
        },
        formattedAddress: "TODO",
      },
    ];
    store.dispatch(
      geocodingSlice.actions.changeQueryRequested({
        locator,
        lookup: query,
        countryCode: defaultCountryCode,
      }),
    );
    expectDebouncingToBe(true);
    dependencies.scheduler.flush();
    expectDebouncingToBe(false);
    expectLoadingToBe(true);
    dependencies.addressGateway.lookupStreetAddressResults$.next(
      expectedSuggestions,
    );
    expectLoadingToBe(false);
    expectSuggestionsToBe(expectedSuggestions);
  });

  it("should update selected suggestion in store", () => {
    const addressAndPosition: AddressWithCountryCodeAndPosition = {
      address: {
        city: "Paris",
        departmentCode: "75",
        postcode: "75000",
        streetNumberAndAddress: "123 Rue de la Paix",
        countryCode: defaultCountryCode,
      },
      position: {
        lat: 49.6548,
        lon: 2.65498,
      },
    };
    store.dispatch(
      geocodingSlice.actions.selectSuggestionRequested({
        item: addressAndPosition,
        locator,
      }),
    );
    expectSelectedSuggestionToBe(addressAndPosition);
  });

  it("should keep selected suggestion in store when selecting another suggestion", () => {
    const previouslySelectedSuggestion: AddressWithCountryCodeAndPosition = {
      address: {
        city: "Paris",
        departmentCode: "75",
        postcode: "75000",
        streetNumberAndAddress: "123 Rue de la Paix",
        countryCode: defaultCountryCode,
      },
      position: {
        lat: 49.6548,
        lon: 2.65498,
      },
    };
    store.dispatch(
      geocodingSlice.actions.selectSuggestionRequested({
        item: previouslySelectedSuggestion,
        locator,
      }),
    );
    const newSelectedSuggestion: AddressWithCountryCodeAndPosition = {
      address: {
        city: "Paris",
        departmentCode: "75",
        postcode: "75000",
        streetNumberAndAddress: "123 Rue de la Paix",
        countryCode: defaultCountryCode,
      },
      position: {
        lat: 49.6548,
        lon: 2.65498,
      },
    };
    store.dispatch(
      geocodingSlice.actions.selectSuggestionRequested({
        item: newSelectedSuggestion,
        locator: anotherLocator,
      }),
    );
    expectSelectedSuggestionToBe(previouslySelectedSuggestion);
    expectToEqual(
      makeGeocodingLocatorSelector(anotherLocator)(store.getState())?.value,
      newSelectedSuggestion,
    );
  });

  it("should throw an error if something goes wrong and returns error feedback", () => {
    const errorMessage = "Error trying to get location";
    store.dispatch(
      geocodingSlice.actions.fetchSuggestionsRequested({
        locator,
        lookup: "bord",
        countryCode: defaultCountryCode,
        selectFirstSuggestion: false,
      }),
    );
    dependencies.addressGateway.lookupStreetAddressResults$.error(
      new Error(errorMessage),
    );
    expectLoadingToBe(false);
  });

  it("should select the first suggestion if selectFirstSuggestion is true", () => {
    const expectedSuggestions: AddressAndPositionWithFormattedAddress[] = [
      {
        address: {
          city: "Paris",
          departmentCode: "75",
          postcode: "75000",
          streetNumberAndAddress: "123 Rue de la Paix",
          countryCode: defaultCountryCode,
        },
        position: {
          lat: 48.8566,
          lon: 2.3522,
        },
        formattedAddress: "TODO",
      },
    ];
    store.dispatch(
      geocodingSlice.actions.fetchSuggestionsRequested({
        locator,
        lookup: "bord",
        countryCode: defaultCountryCode,
        selectFirstSuggestion: true,
      }),
    );
    dependencies.addressGateway.lookupStreetAddressResults$.next(
      expectedSuggestions,
    );
    expectLoadingToBe(false);
    expectSelectedSuggestionToBe(expectedSuggestions[0]);
  });

  it("should select the first suggestion if siret info is successfully fetched", () => {
    const expectedSuggestions: AddressAndPositionWithFormattedAddress[] = [
      {
        address: {
          city: "Paris",
          departmentCode: "75",
          postcode: "75000",
          streetNumberAndAddress: "123 Rue de la Paix",
          countryCode: defaultCountryCode,
        },
        position: {
          lat: 48.8566,
          lon: 2.3522,
        },
        formattedAddress: "TODO",
      },
    ];
    store.dispatch(
      siretSlice.actions.siretInfoSucceeded({
        siretEstablishment: {
          businessAddress: "123 Rue de la Paix",
          businessName: "test",
          isOpen: true,
          numberEmployeesRange: "1-2",
          siret: "12345678901234",
          isAlreadySaved: false,
        },
        feedbackTopic: "siret-input",
        addressAutocompleteLocator: locator,
        countryCode: defaultCountryCode,
      }),
    );
    dependencies.addressGateway.lookupStreetAddressResults$.next(
      expectedSuggestions,
    );
    expectLoadingToBe(false);
    expectSelectedSuggestionToBe(expectedSuggestions[0]);
  });

  const expectQueryToBe = (expected: string) => {
    expectToEqual(
      makeGeocodingLocatorSelector(locator)(store.getState())?.query,
      expected,
    );
  };
  const expectLoadingToBe = (expected: boolean) => {
    expectToEqual(
      makeGeocodingLocatorSelector(locator)(store.getState())?.isLoading,
      expected,
    );
  };
  const expectDebouncingToBe = (expected: boolean) => {
    expectToEqual(
      makeGeocodingLocatorSelector(locator)(store.getState())?.isDebouncing,
      expected,
    );
  };
  const expectSuggestionsToBe = (
    expected: AddressWithCountryCodeAndPosition[],
  ) => {
    expectArraysToEqual(
      makeGeocodingLocatorSelector(locator)?.(store.getState())?.suggestions ??
        [],
      expected,
    );
  };
  const expectSelectedSuggestionToBe = (
    expected: AddressWithCountryCodeAndPosition,
  ) => {
    expectObjectsToMatch(
      makeGeocodingLocatorSelector(locator)(store.getState())?.value,
      expected,
    );
  };
  it("populates agency-address when agency is fetched", () => {
    const address = {
      streetNumberAndAddress: "1 rue de la paix",
      postcode: "75016",
      departmentCode: "75",
      city: "Paris",
    };
    const agencyDto = new AgencyDtoBuilder().withAddress(address).build();

    store.dispatch(
      fetchAgencySlice.actions.fetchAgencyRequested({
        agencyId: agencyDto.id,
        feedbackTopic: "agency-admin",
      }),
    );
    dependencies.agencyGateway.fetchedAgency$.next(agencyDto);

    expectToEqual(
      makeGeocodingLocatorSelector("agency-address")(store.getState())?.value,
      {
        address: {
          ...address,
          countryCode: defaultCountryCode,
        },
        position: {
          lat: agencyDto.position.lat,
          lon: agencyDto.position.lon,
        },
        formattedAddress: addressDtoToString(agencyDto.address),
      },
    );
  });
});
