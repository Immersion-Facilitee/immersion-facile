import { randomInt } from "node:crypto";
import { OTP_CODE_LENGTH, type OtpCode } from "shared";
import type { OtpCodeGeneratorGateway } from "../../port/OtpCodeGeneratorGateway";

export class CryptoOtpCodeGeneratorGateway implements OtpCodeGeneratorGateway {
  public readonly codeLength = OTP_CODE_LENGTH;

  public generate(): OtpCode {
    return randomInt(0, 10 ** this.codeLength)
      .toString()
      .padStart(this.codeLength, "0");
  }
}
