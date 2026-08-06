import { normalize } from "./textSearch";

describe("normalize", () => {
  it("removes accents", () => {
    expect(normalize("à")).toBe("a");
    expect(normalize("é")).toBe("e");
    expect(normalize("ï")).toBe("i");
    expect(normalize("ô")).toBe("o");
    expect(normalize("ü")).toBe("u");
  });

  it("converts to lower case", () => {
    expect(normalize("AaBbCc")).toBe("aabbcc");
  });
});
