import { CryptoOtpCodeGeneratorGateway } from "./CryptoOtpCodeGeneratorGateway";

describe("CryptoOtpCodeGeneratorGateway", () => {
  const otpCodeGeneratorGateway = new CryptoOtpCodeGeneratorGateway();
  const otpCodes = Array.from({ length: 10_000 }, () =>
    otpCodeGeneratorGateway.generate(),
  );

  it("generates only numeric codes of the expected length", () => {
    expect(otpCodes.every((otpCode) => /^\d{6}$/.test(otpCode))).toBeTruthy();
  });

  it("generates varied codes", () => {
    expect(new Set(otpCodes).size).toBeGreaterThan(9_000);
  });
});
