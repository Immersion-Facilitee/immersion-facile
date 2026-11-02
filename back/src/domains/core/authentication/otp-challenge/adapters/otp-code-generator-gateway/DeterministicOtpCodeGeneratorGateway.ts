import { errors, type OtpCode } from "shared";
import type { OtpCodeGeneratorGateway } from "../../port/OtpCodeGeneratorGateway";

export class DeterministicOtpCodeGeneratorGateway
  implements OtpCodeGeneratorGateway
{
  #nextOtpCodes: OtpCode[] = [];

  public setNextOtpCodes(nextOtpCodes: OtpCode[]): void {
    this.#nextOtpCodes = [...this.#nextOtpCodes, ...nextOtpCodes];
  }

  public generate(): OtpCode {
    const nextOtpCode = this.#nextOtpCodes.shift();
    if (!nextOtpCode)
      throw errors.generic.fakeError(
        "No more otp codes available. Please be deterministic.",
      );
    return nextOtpCode;
  }
}
