import {
  type AddressAndPosition,
  type AddressDtoWithCountryCode,
  defaultCountryCode,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type GeoPositionDto,
  type Location,
  type LookupSearchResult,
  type SupportedCountryCode,
} from "shared";
import { createFetchSharedClient } from "shared-routes/fetch";
import { AppConfig } from "../../../../config/bootstrap/appConfig";
import { withNoCache } from "../../caching-gateway/adapters/withNoCache";
import type { AddressGateway } from "../ports/AddressGateway";
import { HttpAddressGateway } from "./HttpAddressGateway";
import { addressesExternalRoutes } from "./HttpAddressGateway.routes";

const resultFromApiAddress = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      position: {
        type: "Point",
        coordinates: [7.511081, 48.532594],
      },
      properties: {
        label: "14 Rue Gaston Romazzotti 67120 Molsheim",
        score: 0.9999999831759846,
        housenumber: "14",
        id: "67300_0263_00014",
        name: "14 Rue Gaston Romazzotti",
        postcode: "67120",
        citycode: "67300",
        x: 1032871.72,
        y: 6835328.47,
        city: "Molsheim",
        context: "67, Bas-Rhin, Grand Est",
        type: "housenumber",
        importance: 0.55443,
        street: "Rue Gaston Romazzotti",
      },
    },
  ],
};

const geocodingApiKey = AppConfig.createFromEnv().apiKeyOpenCageDataGeocoding;
const geosearchApiKey = AppConfig.createFromEnv().apiKeyOpenCageDataGeosearch;

describe("HttpOpenCageDataAddressGateway", () => {
  let httpAddressGateway: AddressGateway;

  beforeEach(() => {
    const config = AppConfig.createFromEnv();
    httpAddressGateway = new HttpAddressGateway(
      createFetchSharedClient(addressesExternalRoutes, fetch, {
        timeout: config.externalAxiosTimeout,
        skipResponseValidation: true,
      }),
      geocodingApiKey,
      geosearchApiKey,
      withNoCache,
    );
  });

  describe("lookupStreetAddress, postcode is now mandatory", () => {
    describe("Right paths", () => {
      describe("Problematic addresses", () => {
        it.each<{ candidateQuery: string; expectedResult: Location }>([
          {
            candidateQuery: "47 Rue Dupont des Loges 57000 Metz",
            expectedResult: {
              address: {
                city: "Metz",
                departmentCode: "57",
                postcode: "57000",
                streetNumberAndAddress: "47 Rue Dupont des Loges",
              },
              id: "123",
              position: {
                lat: 49.11436415,
                lon: 6.17377662619927,
              },
            },
          },
          {
            candidateQuery: "111 Meinglazou 29260 Lesneven",
            expectedResult: {
              address: {
                city: "Lesneven",
                departmentCode: "29",
                postcode: "29260",
                streetNumberAndAddress: "",
              },
              position: {
                lat: 48.5787522,
                lon: -4.2966868,
              },
              id: "123",
            },
          },
          {
            candidateQuery:
              "2 rue des Anciens Combattants d'Afrique du Nord, 54200 Toul",
            expectedResult: {
              address: {
                city: "Toul",
                departmentCode: "54",
                postcode: "54200",
                streetNumberAndAddress:
                  "2 Rue des Anciens Combattants d'Afrique du Nord",
              },
              position: {
                lat: 48.671259,
                lon: 5.891857,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "17 place Sainte Luce 06800 Cagnes sur Mer",
            expectedResult: {
              address: {
                city: "Cagnes-sur-Mer",
                departmentCode: "06",
                postcode: "06800",
                streetNumberAndAddress: "Place Sainte-Luce",
              },
              position: {
                lat: 43.664522,
                lon: 7.1494273,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "21 Rue Monthyon Saint-Denis 97400",
            expectedResult: {
              address: {
                city: "Saint-Denis",
                departmentCode: "974",
                postcode: "97400",
                streetNumberAndAddress: "21 Rue Monthyon",
              },
              position: {
                lat: -20.887292,
                lon: 55.455501,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "69120",
            expectedResult: {
              address: {
                city: "Vaulx-en-Velin",
                departmentCode: "69",
                postcode: "69120",
                streetNumberAndAddress: "",
              },
              position: {
                lat: 45.771767625,
                lon: 4.92455044791667,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "75016",
            expectedResult: {
              address: {
                city: "Paris",
                departmentCode: "75",
                postcode: "75016",
                streetNumberAndAddress: "",
              },
              position: {
                lat: 48.8523073360927,
                lon: 2.27125068377483,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "Avenue des Champs élyssés Paris",
            expectedResult: {
              address: {
                city: "Paris 8e Arrondissement",
                departmentCode: "75",
                postcode: "75008",
                streetNumberAndAddress: "Avenue des Champs-Élysées",
              },
              position: {
                lat: 48.8695,
                lon: 2.308483,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "Carcassonne",
            expectedResult: {
              address: {
                city: "Carcassonne",
                departmentCode: "11",
                postcode: "11000",
                streetNumberAndAddress: "",
              },
              position: {
                lat: 43.2130358,
                lon: 2.3491069,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "rue Chanzy Lunévile 54300",
            expectedResult: {
              address: {
                city: "Lunéville",
                departmentCode: "54",
                postcode: "54300",
                streetNumberAndAddress: "Rue du Général Chanzy",
              },
              position: {
                lat: 48.596289,
                lon: 6.489476,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "LIEU DIT LE GROS CHATELET GARE 88200 Remiremont",
            expectedResult: {
              address: {
                city: "Remiremont",
                departmentCode: "88",
                postcode: "88200",
                streetNumberAndAddress: "Gros Chatelet",
              },
              position: {
                lat: 48.01562,
                lon: 6.600757,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "97150 Saint-Martin",
            expectedResult: {
              address: {
                city: "Saint-Martin",
                departmentCode: "971",
                postcode: "97150",
                streetNumberAndAddress: "",
              },
              position: {
                lat: 18.06481835,
                lon: -63.049171129033,
              },
              id: "123",
            },
          },
        ])(
          `Should work if searching for '$candidateQuery' query expect:
              - address: '$expectedResult.address'
              - position: '$expectedResult.position'`,
          async ({ candidateQuery, expectedResult }) => {
            const resultMetropolitanFrance =
              await httpAddressGateway.lookupStreetAddress(
                candidateQuery,
                "FR",
              );

            const firstResult: AddressAndPosition | undefined =
              resultMetropolitanFrance.at(0);
            expectToEqual(firstResult?.address, expectedResult.address);
            expect(expectedResult.position.lon).toBeCloseTo(
              expectedResult.position.lon,
            );
            expect(expectedResult.position.lat).toBeCloseTo(
              expectedResult.position.lat,
              3,
            );
          },
          10000,
        );
      });
      describe("with foreign addresses", () => {
        it.each<{
          candidateQuery: string;
          countryCode: SupportedCountryCode;
          expectedResult: Location;
        }>([
          {
            candidateQuery: "J.C. JACOBSENS GADE 1 1799 COPENHAGUE V DANEMARK",
            countryCode: "DK",
            expectedResult: {
              address: {
                city: "Copenhague",
                departmentCode: "99",
                postcode: "1799",
                streetNumberAndAddress: "1 J.C. Jacobsens Gade",
              },
              position: {
                lat: 55.676098,
                lon: 12.568337,
              },
              id: "123",
            },
          },
          {
            candidateQuery: "20 A KRONENSTRASSE, 30161 HANNOVER, ALLEMAGNE",
            countryCode: "DE",
            expectedResult: {
              address: {
                city: "Hanovre",
                departmentCode: "99",
                postcode: "30161",
                streetNumberAndAddress: "Kronenstraße",
              },
              position: {
                lat: 48.532594,
                lon: 7.511081,
              },
              id: "123",
            },
          },
        ])(
          `Should work if searching for '$candidateQuery' query expect:
              - address: '$expectedResult.address'
              - position: '$expectedResult.position'`,
          async ({ candidateQuery, countryCode, expectedResult }) => {
            const result = await httpAddressGateway.lookupStreetAddress(
              candidateQuery,
              countryCode,
            );
            const firstResult: AddressAndPosition | undefined = result.at(0);
            expectToEqual(firstResult?.address, expectedResult.address);
            expect(expectedResult.position.lon).toBeCloseTo(
              expectedResult.position.lon,
            );
            expect(expectedResult.position.lat).toBeCloseTo(
              expectedResult.position.lat,
              3,
            );
          },
          10000,
        );
      });
    });

    it("Should return expected address DTO when providing address with special characters.", async () => {
      expectToEqual(
        await httpAddressGateway.lookupStreetAddress(
          "Route d’Huez 38750 Huez",
          "FR",
        ),
        [
          {
            position: {
              lat: 45.0891528,
              lon: 6.0575141,
            },
            address: {
              streetNumberAndAddress: "Route d'Huez",
              postcode: "38750",
              departmentCode: "38",
              city: "L'Alpe d'Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Route d'Huez, 38750 L'Alpe d'Huez, France",
          },
          {
            position: {
              lat: 45.091271,
              lon: 6.061676,
            },
            address: {
              streetNumberAndAddress: "Route d’Huez",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Route d’Huez, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.093113,
              lon: 6.064856,
            },
            address: {
              streetNumberAndAddress: "Route du Signal",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Route du Signal, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.091898,
              lon: 6.065363,
            },
            address: {
              streetNumberAndAddress: "Route du Coulet",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Route du Coulet, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.091666,
              lon: 6.063278,
            },
            address: {
              streetNumberAndAddress: "Route de la Poste",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Route de la Poste, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.09258,
              lon: 6.06999,
            },
            address: {
              streetNumberAndAddress: "Avenue de l’Etendard",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Avenue de l’Etendard, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.0905,
              lon: 6.059899,
            },
            address: {
              streetNumberAndAddress: "Rue des Sagnes",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Rue des Sagnes, 38750 Huez, France",
          },
          {
            position: {
              lat: 45.08667,
              lon: 6.066699,
            },
            address: {
              streetNumberAndAddress: "",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Huez, Isère, France",
          },
          {
            position: {
              lat: 45.091617,
              lon: 6.068107,
            },
            address: {
              streetNumberAndAddress: "Avenue des Jeux",
              postcode: "38750",
              departmentCode: "38",
              city: "Huez",
              countryCode: defaultCountryCode,
            },
            formattedAddress: "Avenue des Jeux, 38750 Huez, France",
          },
        ],
      );
    });

    it("Should not support lookup address with only one char.", async () => {
      await expectPromiseToFailWithError(
        httpAddressGateway.lookupStreetAddress("R", "FR"),
        errors.address.queryToShort({ minLength: 2 }),
      );
    });

    it("Query too long with +18 words", async () => {
      await expectPromiseToFailWithError(
        httpAddressGateway.lookupStreetAddress(
          "a A d S E a a a a a a a a a a a a a a",
          "FR",
        ),
        errors.generic.testError("Request failed with status code 400"),
      );
    });

    it("Should not support lookup address with two chars including one special char.", async () => {
      await expectPromiseToFailWithError(
        httpAddressGateway.lookupStreetAddress("R,", "FR"),
        errors.address.queryToShort({ minLength: 2 }),
      );
    });

    it("Should not support lookup address with 3 chars matching the pattern '{digit} ,'", async () => {
      await expectPromiseToFailWithError(
        httpAddressGateway.lookupStreetAddress("4 ,", "FR"),
        errors.address.queryToShort({ minLength: 2 }),
      );
    });

    it("Should support lookup address with two char.", async () => {
      const resultPreviousNotFoundWithAddresseAPI =
        await httpAddressGateway.lookupStreetAddress("Ro", "FR");

      expectToEqual(resultPreviousNotFoundWithAddresseAPI.at(0), {
        address: {
          city: "Saillagouse",
          departmentCode: "66",
          postcode: "66800",
          streetNumberAndAddress: "",
          countryCode: defaultCountryCode,
        },
        position: {
          lat: 42.4583078,
          lon: 2.018601,
        },
        formattedAddress: "66800 Saillagouse, France",
      });
    });
  });

  describe("lookupLocationName", () => {
    it.each([
      {
        candidateQuery: "Uzerche",
        expectedSearchResult: [
          {
            label: "Uzerche, Nouvelle-Aquitaine, France",
            position: {
              lat: 45.42433,
              lon: 1.56373,
            },
          },
        ],
      },
      {
        candidateQuery: "Paris",
        expectedSearchResult: [
          {
            label: "Paris, Île-de-France, France",
            position: {
              lat: 48.8535,
              lon: 2.34839,
            },
          },
          {
            label: "Paris 16e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.86317,
              lon: 2.27576,
            },
          },
          {
            label: "Montmartre, Paris, Île-de-France, France",
            position: {
              lat: 48.88671,
              lon: 2.34157,
            },
          },
          {
            label: "Paris-l'Hôpital, Bourgogne-Franche-Comté, France",
            position: {
              lat: 46.91503,
              lon: 4.63302,
            },
          },
          {
            label: "Paris 8e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.87748,
              lon: 2.31765,
            },
          },
          {
            label: "Paris 15e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.84137,
              lon: 2.30038,
            },
          },
          {
            label: "Paris 7e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.85703,
              lon: 2.3202,
            },
          },
          {
            label: "Paris 6e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.85043,
              lon: 2.33295,
            },
          },
          {
            label: "Paris 9e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.87602,
              lon: 2.33996,
            },
          },
          {
            label: "Paris 14e Arrondissement, Paris, Île-de-France, France",
            position: {
              lat: 48.82957,
              lon: 2.32396,
            },
          },
        ],
      },
      {
        candidateQuery: "75001",
        expectedSearchResult: [],
      },
      {
        candidateQuery: "Bordeaux 33000",
        expectedSearchResult: [],
      },
      {
        candidateQuery: "bar",
        expectedSearchResult: [
          {
            label: "Baralle, Hauts-de-France, France",
            position: {
              lat: 50.21132,
              lon: 3.05763,
            },
          },
          {
            label: "Barastre, Hauts-de-France, France",
            position: {
              lat: 50.07605,
              lon: 2.93402,
            },
          },
          {
            label: "Barly, Hauts-de-France, France",
            position: {
              lat: 50.25129,
              lon: 2.54786,
            },
          },
          {
            label: "Barlin, Hauts-de-France, France",
            position: {
              lat: 50.45684,
              lon: 2.61748,
            },
          },
          {
            label: "Bar-le-Duc, Meuse, France",
            position: {
              lat: 48.77127,
              lon: 5.16238,
            },
          },
          {
            label: "Barenton-sur-Serre, Hauts-de-France, France",
            position: {
              lat: 49.66996,
              lon: 3.68137,
            },
          },
          {
            label: "Barenton-Bugny, Hauts-de-France, France",
            position: {
              lat: 49.6335,
              lon: 3.6524,
            },
          },
          {
            label: "Barenton-Cel, Hauts-de-France, France",
            position: {
              lat: 49.6425,
              lon: 3.6536,
            },
          },
          {
            label: "Barzy-en-Thiérache, Hauts-de-France, France",
            position: {
              lat: 50.04389,
              lon: 3.74694,
            },
          },
          {
            label: "Barzy-sur-Marne, Hauts-de-France, France",
            position: {
              lat: 49.08648,
              lon: 3.55282,
            },
          },
        ],
      },
    ])(
      "Should work if searching for '$candidateQuery' location query expect '$expectedSearchResult.length' results.",
      async ({
        candidateQuery,
        expectedSearchResult,
      }: {
        candidateQuery: string;
        expectedSearchResult: LookupSearchResult[];
      }) => {
        const resultMetropolitanFrance =
          await httpAddressGateway.lookupLocationName(candidateQuery);
        expectToEqual(resultMetropolitanFrance, expectedSearchResult);
      },
      10000,
    );
  });

  describe("check parallel calls", () => {
    const parallelCalls = 50;

    it(`Should support ${parallelCalls} of /getAddressFromPosition parallel calls`, async () => {
      const coordinates: GeoPositionDto[] = [];
      const expectedResults: AddressDtoWithCountryCode[] = [];

      for (let index = 0; index < parallelCalls; index++) {
        coordinates.push({
          lat: resultFromApiAddress.features[0].position.coordinates[1],
          lon: resultFromApiAddress.features[0].position.coordinates[0],
        });
        expectedResults.push({
          streetNumberAndAddress: "14 Rue Gaston Romazzotti",
          city: "Molsheim",
          departmentCode: "67",
          postcode: "67120",
          countryCode: defaultCountryCode,
        });
      }
      const results: (AddressDtoWithCountryCode | undefined)[] =
        await Promise.all(
          coordinates.map((coordinate) =>
            httpAddressGateway.getAddressFromPosition(coordinate),
          ),
        );

      expectToEqual(results, expectedResults);
    }, 15000);
  });
});
