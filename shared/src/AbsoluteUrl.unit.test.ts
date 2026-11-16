import {
  type AbsoluteUrl,
  absoluteUrlSchema,
  callbackUrlSchema,
  toAbsoluteUrl,
} from "./AbsoluteUrl";

describe("toAbsoluteUrl conversion", () => {
  const urlsToCheck: [string, AbsoluteUrl][] = [
    ["beta.gouv.fr", "https://beta.gouv.fr"],
    ["mon-site.fr.st", "https://mon-site.fr.st"],
    ["super-site.com", "https://super-site.com"],
    ["www.un-autre-site.com", "https://www.un-autre-site.com"],
    ["super-site.com/avec/un/path", "https://super-site.com/avec/un/path"],
    [
      "www.un-autre-site.com/avec/un/path?et&des=params",
      "https://www.un-autre-site.com/avec/un/path?et&des=params",
    ],
    ["http://un-autre-site-en-http.com", "http://un-autre-site-en-http.com"],
    [
      "https://un-autre-site-en-https.com",
      "https://un-autre-site-en-https.com",
    ],
  ];

  it.each(urlsToCheck)("url %s should equal to %s", (url, expectedUrl) => {
    expect(toAbsoluteUrl(url)).toBe(expectedUrl);
  });
});

describe("absolutUrlSchema", () => {
  it("", () => {
    const urlWithJWT: AbsoluteUrl =
      "http://url.com/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(absoluteUrlSchema.parse(urlWithJWT)).toBe(urlWithJWT);
  });
});

describe("callbackUrlSchema", () => {
  it("should accept a valid url", () => {
    expect(callbackUrlSchema.parse("https://www.example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("should throw on local url", () => {
    expect(() => callbackUrlSchema.parse("https://127.0.0.1")).toThrow();
    expect(() => callbackUrlSchema.parse("https://localhost/path")).toThrow();
    expect(() => callbackUrlSchema.parse("https://::1")).toThrow();
  });
});
