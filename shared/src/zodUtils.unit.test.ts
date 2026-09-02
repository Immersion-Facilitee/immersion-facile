import { ZodError } from "zod";
import { trueSchema, zToBoolean, zToNumber } from "./zodUtils";

describe("zodUtils", () => {
  describe("zToBoolean schema validation", () => {
    it.each([
      ["true", true],
      ["TRUE", true],
      [true, true],
      ["1", true],
      [1, true],
      ["false", false],
      ["FALSE", false],
      ["0", false],
      [undefined, false],
      [null, false],
      [false, false],
      [0, false],
    ])("boolean '%s' to be parsed to %s", (boolean, expectedBoolean) => {
      expect(zToBoolean.parse(boolean)).toBe(expectedBoolean);
    });
  });

  describe("zToNumber schema validation", () => {
    it.each([
      [1, 1],
      [1.2, 1.2],
      ["0", 0],
      ["0.1", 0.1],
    ])("boolean '%s' to be parsed to '%s'", (boolean, expectedNumber) => {
      expect(zToNumber.parse(boolean)).toBe(expectedNumber);
    });

    it.each(["0,1", "not a number"])(
      "boolean '%s' to be invalid",
      (boolean) => {
        expect(() => zToNumber.parse(boolean)).toThrow();
      },
    );
  });

  describe("trueSchema", () => {
    const invalidInputZodError = new ZodError([
      {
        code: "custom",
        path: [],
        message: "Invalid input",
      },
    ]);
    it.each([
      { input: true, result: true },
      { input: "true", result: true },
      { input: "1", result: true },
      {
        input: false,
        result: invalidInputZodError,
      },
      { input: "false", result: invalidInputZodError },
      { input: "0", result: invalidInputZodError },
      {
        input: "not a boolean string",
        result: invalidInputZodError,
      },
    ] satisfies {
      input: string | boolean;
      result: ZodError | true;
    }[])("boolean : $input", ({ input, result }) => {
      if (result instanceof ZodError)
        expect(() => trueSchema.parse(input)).toThrow(result);
      else expect(trueSchema.parse(input)).toBe(result);
    });
  });
});
