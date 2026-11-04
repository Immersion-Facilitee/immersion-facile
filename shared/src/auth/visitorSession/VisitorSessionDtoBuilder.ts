import type { Builder } from "../../Builder";
import type { DateTimeIsoString } from "../../utils/date";
import type { OtpChallengeSubjectByPurpose } from "../otpChallenge/otpChallenge.dto";
import type { VisitorSession, VisitorSessionId } from "./visitorSession.dto";

const defaultVisitorSession: VisitorSession = {
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

export class VisitorSessionDtoBuilder implements Builder<VisitorSession> {
  #dto: VisitorSession = defaultVisitorSession;

  constructor(dto = defaultVisitorSession) {
    this.#dto = dto;
  }

  withId(id: VisitorSessionId) {
    return new VisitorSessionDtoBuilder({ ...this.#dto, id });
  }

  withSubject(
    subject: OtpChallengeSubjectByPurpose[VisitorSession["purpose"]],
  ) {
    return new VisitorSessionDtoBuilder({ ...this.#dto, subject });
  }

  withExpiresAt(expiresAt: DateTimeIsoString) {
    return new VisitorSessionDtoBuilder({ ...this.#dto, expiresAt });
  }

  withRevokedAt(revokedAt: DateTimeIsoString | null) {
    return new VisitorSessionDtoBuilder({ ...this.#dto, revokedAt });
  }

  withCreatedAt(createdAt: DateTimeIsoString) {
    return new VisitorSessionDtoBuilder({ ...this.#dto, createdAt });
  }

  build() {
    return this.#dto;
  }
}
