import { ImmersionFacileApiError } from "./immersionFacileApi";

describe("ImmersionFacileApiError", () => {
  it("stores status, message and optional issues", () => {
    const error = new ImmersionFacileApiError(400, "Bad request", [
      "appellationCodes required",
    ]);

    expect(error).toBeInstanceOf(Error);
    expect(error).toEqual(
      new ImmersionFacileApiError(400, "Bad request", [
        "appellationCodes required",
      ]),
    );
  });
});
