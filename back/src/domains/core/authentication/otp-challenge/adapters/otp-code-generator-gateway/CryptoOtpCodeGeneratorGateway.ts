import { randomInt } from "node:crypto";
import type { OtpCode } from "shared";
import type { OtpCodeGeneratorGateway } from "../../port/OtpCodeGeneratorGateway";

export class CryptoOtpCodeGeneratorGateway implements OtpCodeGeneratorGateway {
  public readonly codeLength = 6;

  public generate(): OtpCode {
    return randomInt(0, 10 ** this.codeLength)
      .toString()
      .padStart(this.codeLength, "0");
  }
}
