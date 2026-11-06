import { getFrontBaseUrl, ImmersionFacileApiError } from "./immersionFacileApi";

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

describe("getFrontBaseUrl", () => {
  afterEach(() => {
    delete process.env.DOMAIN;
  });

  it("uses http for localhost and loopback IPs", () => {
    process.env.DOMAIN = "localhost:3000";
    expect(getFrontBaseUrl()).toBe("http://localhost:3000");

    process.env.DOMAIN = "127.0.0.1:3000";
    expect(getFrontBaseUrl()).toBe("http://127.0.0.1:3000");
  });

  it("uses https for non-loopback domains", () => {
    process.env.DOMAIN = "immersion-facile.beta.gouv.fr";
    expect(getFrontBaseUrl()).toBe("https://immersion-facile.beta.gouv.fr");
  });
});
