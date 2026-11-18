import type { Builder } from "../../Builder";
import type { DateTimeIsoString } from "../../utils/date";
import type { OtpChallengeSubjectByPurpose } from "../otpChallenge/otpChallenge.dto";
import type { OtpSession, OtpSessionId } from "./otpSession.dto";

const defaultOtpSession: OtpSession = {
  id: "11111111-1111-4111-a111-111111111111",
  purpose: "manageConvention",
  subject: {
    conventionId: "11111111-1111-4111-a111-111111111111",
    role: "establishment-tutor",
    emailHash: "123",
  },
  expiresAt: new Date("2024-04-28T12:00:00.000Z").toISOString(),
  revokedAt: null,
  createdAt: new Date("2024-04-28T12:00:00.000Z").toISOString(),
};

export class OtpSessionDtoBuilder implements Builder<OtpSession> {
  #dto: OtpSession = defaultOtpSession;

  constructor(dto = defaultOtpSession) {
    this.#dto = dto;
  }

  withId(id: OtpSessionId) {
    return new OtpSessionDtoBuilder({ ...this.#dto, id });
  }

  withSubject(subject: OtpChallengeSubjectByPurpose[OtpSession["purpose"]]) {
    return new OtpSessionDtoBuilder({ ...this.#dto, subject });
  }

  withExpiresAt(expiresAt: DateTimeIsoString) {
    return new OtpSessionDtoBuilder({ ...this.#dto, expiresAt });
  }

  withRevokedAt(revokedAt: DateTimeIsoString | null) {
    return new OtpSessionDtoBuilder({ ...this.#dto, revokedAt });
  }

  withCreatedAt(createdAt: DateTimeIsoString) {
    return new OtpSessionDtoBuilder({ ...this.#dto, createdAt });
  }

  build() {
    return this.#dto;
  }
}
