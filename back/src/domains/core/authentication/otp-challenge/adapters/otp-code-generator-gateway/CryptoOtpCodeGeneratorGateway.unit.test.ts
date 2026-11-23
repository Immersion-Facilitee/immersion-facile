import { OTP_CODE_LENGTH } from "shared";
import { CryptoOtpCodeGeneratorGateway } from "./CryptoOtpCodeGeneratorGateway";

describe("CryptoOtpCodeGeneratorGateway", () => {
  it(`generates a numeric code of ${OTP_CODE_LENGTH} digits`, () => {
    expect(new CryptoOtpCodeGeneratorGateway().generate()).toMatch(
      new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`),
    );
  });
});
