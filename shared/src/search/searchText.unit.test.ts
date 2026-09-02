import { v4 as uuid } from "uuid";
import {
  searchTextAlphaNumericSchema,
  searchTextAlphaSchema,
} from "./searchText.schema";

describe("searchTextSchema", () => {
  it("accepts if not empty", () => {
    expect(() => searchTextAlphaSchema.parse("")).toThrow();
    expect(() => searchTextAlphaSchema.parse("taxi")).not.toThrow();
  });

  it.each([
    { initialSearchText: "<lapins", expectedSearchText: "lapins" },
    {
      initialSearchText: "montage-assemblage",
      expectedSearchText: "montage-assemblage",
    },
    {
      initialSearchText: "secrétaire",
      expectedSearchText: "secrétaire",
    },
    {
      initialSearchText: "secrétaire#",
      expectedSearchText: "secrétaire",
    },
    {
      initialSearchText: "boulanger / patissier",
      expectedSearchText: "boulanger   patissier",
    },
  ])(
    "for $initialSearchText, replace special characters by space then trim",
    ({ initialSearchText, expectedSearchText }) => {
      const newSearchText = searchTextAlphaSchema.parse(initialSearchText);
      expect(newSearchText).toBe(expectedSearchText);
    },
  );
});

describe("searchTextSchemaNumeric", () => {
  const conventionId = uuid();

  it.each([
    { initialSearchText: "   <   ", expectedSearchText: "" },
    { initialSearchText: "<lapins-0123", expectedSearchText: "lapins-0123" },
    {
      initialSearchText: "montage-assemblage-71",
      expectedSearchText: "montage-assemblage-71",
    },
    {
      initialSearchText: "secrétaire",
      expectedSearchText: "secrétaire",
    },
    {
      initialSearchText: "secrétaire#-0",
      expectedSearchText: "secrétaire -0",
    },
    {
      initialSearchText: "boulanger / patissier1",
      expectedSearchText: "boulanger   patissier1",
    },
    {
      initialSearchText: "boulanger / patissier1",
      expectedSearchText: "boulanger   patissier1",
    },
    {
      initialSearchText: conventionId,
      expectedSearchText: conventionId,
    },
  ])(
    "for $initialSearchText, replace special characters by space then trim",
    ({ initialSearchText, expectedSearchText }) => {
      const newSearchText =
        searchTextAlphaNumericSchema.parse(initialSearchText);
      expect(newSearchText).toBe(expectedSearchText);
    },
  );
});
