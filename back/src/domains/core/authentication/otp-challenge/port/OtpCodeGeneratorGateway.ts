import type { OtpCode } from "shared";

export interface OtpCodeGeneratorGateway {
  generate(): OtpCode;
}
