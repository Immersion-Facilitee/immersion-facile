import { CryptoOtpCodeGeneratorGateway } from "./CryptoOtpCodeGeneratorGateway";

describe("CryptoOtpCodeGeneratorGateway", () => {
  it("generates a numeric code of 4 digits", () => {
    expect(new CryptoOtpCodeGeneratorGateway().generate()).toMatch(/^\d{4}$/);
  });
});
