import {
  type AddressAndPositionWithFormattedAddress,
  type AddressRoutes,
  addressRoutes,
  defaultCountryCode,
  displayRouteName,
  expectHttpResponseToEqual,
  type LookupSearchResult,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { InMemoryAddressGateway } from "../../../../domains/core/address/adapters/InMemoryAddressGateway";
import {
  expected8bdduportAddressAndPositions,
  query8bdduportLookup,
} from "../../../../domains/core/address/adapters/testUtils";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe("address router", () => {
  let httpClient: HttpClient<AddressRoutes>;
  let addressGateway: InMemoryAddressGateway;
  const expectedAddressAndPositions: AddressAndPositionWithFormattedAddress[] =
    expected8bdduportAddressAndPositions.map((location) => ({
      ...location,
      address: {
        ...location.address,
        countryCode: defaultCountryCode,
      },
      formattedAddress: "Fake address",
    }));

  beforeEach(async () => {
    const { request, gateways } = await buildTestApp();
    httpClient = createSupertestSharedClient(addressRoutes, request);
    addressGateway = gateways.addressApi;
  });

  describe("GET /address/lookupStreetAddress", () => {
    it(`${displayRouteName(
      addressRoutes.lookupStreetAddress,
    )} 200 with lookup="${query8bdduportLookup}"`, async () => {
      addressGateway.setNextLookupStreetAndAddresses([
        expectedAddressAndPositions,
      ]);
      const response = await httpClient.lookupStreetAddress({
        queryParams: {
          lookup: query8bdduportLookup,
          countryCode: defaultCountryCode,
        },
      });
      expectHttpResponseToEqual(response, {
        body: expectedAddressAndPositions,
        status: 200,
      });
    });

    it(`${displayRouteName(
      addressRoutes.lookupStreetAddress,
    )} 400 with lookup="1"`, async () => {
      const response = await httpClient.lookupStreetAddress({
        queryParams: {
          lookup: "1",
          countryCode: defaultCountryCode,
        },
      });
      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: [
            "lookup : Too small: expected string to have >=2 characters",
            "lookup : Too small: expected string to have >=2 characters, excluding special chars",
          ],
          message: `Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /address/lookupStreetAddress`,
          status: 400,
        },
      });
    });

    it(`${displayRouteName(
      addressRoutes.lookupStreetAddress,
    )} 400 with lookup="a a a a a a a a a a a a a a a a a a a"`, async () => {
      const response = await httpClient.lookupStreetAddress({
        queryParams: {
          lookup: "a a a a a a a a a a a a a a a a a a a",
          countryCode: defaultCountryCode,
        },
      });
      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          issues: ["lookup : String must contain a maximum of 18 words"],
          message: `Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /address/lookupStreetAddress`,
          status: 400,
        },
      });
    });

    it.each(["1,", "1, ", "⠀  , a ", " )),$,#                  "])(
      `${displayRouteName(
        addressRoutes.lookupStreetAddress,
      )} 400 with lookup="%s"`,
      async (lookup) => {
        const response = await httpClient.lookupStreetAddress({
          queryParams: {
            lookup,
            countryCode: defaultCountryCode,
          },
        });

        expectHttpResponseToEqual(response, {
          status: 400,
          body: {
            issues: [
              "lookup : Too small: expected string to have >=2 characters, excluding special chars",
            ],
            message: `Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /address/lookupStreetAddress`,
            status: 400,
          },
        });
      },
    );
  });

  describe("GET /address/lookup-location", () => {
    const exampleQuery = "Saint-Emil";
    const expectedLookupSearchResults: LookupSearchResult[] = [
      {
        label: "Saint-Emilion",
        position: {
          lat: 23,
          lon: 12,
        },
      },
    ];

    it(`${displayRouteName(
      addressRoutes.lookupLocation,
    )} 200 with query=exampleQuery`, async () => {
      addressGateway.setLookupSearchResults(expectedLookupSearchResults);
      const response = await httpClient.lookupLocation({
        queryParams: {
          query: exampleQuery,
        },
      });
      expectHttpResponseToEqual(response, {
        body: expectedLookupSearchResults,
        status: 200,
      });
    });
  });
});
