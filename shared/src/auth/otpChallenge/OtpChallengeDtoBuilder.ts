import type { Builder } from "../../Builder";
import type { Email } from "../../email/email.dto";
import type { PhoneNumber } from "../../phone/phone.dto";
import type { DateTimeIsoString } from "../../utils/date";
import type {
  OtpChallenge,
  OtpChallengeId,
  OtpChallengeSubjectByPurpose,
} from "./otpChallenge.dto";

const defaultOtpChallenge: OtpChallenge = {
  id: "11111111-1111-4111-a111-111111111111",
  purpose: "manageConvention",
  subject: {
    conventionId: "11111111-1111-4111-a111-111111111111",
    role: "establishment-tutor",
    emailHash: "123",
  },
  channel: "email",
  recipient: "john.doe@mail.com",
  codeHash: "123",
  attempts: 0,
  expiresAt: new Date("2024-04-28T12:00:00.000Z").toISOString(),
  usedAt: null,
  createdAt: new Date("2024-04-28T12:00:00.000Z").toISOString(),
};

export class OtpChallengeDtoBuilder implements Builder<OtpChallenge> {
  #dto: OtpChallenge = defaultOtpChallenge;

  constructor(dto = defaultOtpChallenge) {
    this.#dto = dto;
  }

  withId(id: OtpChallengeId) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, id });
  }

  withSubject(subject: OtpChallengeSubjectByPurpose[OtpChallenge["purpose"]]) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, subject });
  }

  withChannel(channel: OtpChallenge["channel"]) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, channel });
  }

  withRecipient(recipient: Email | PhoneNumber) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, recipient });
  }

  withCodeHash(codeHash: string) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, codeHash });
  }

  withAttempts(attempts: number) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, attempts });
  }

  withExpiresAt(expiresAt: DateTimeIsoString) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, expiresAt });
  }

  withUsedAt(usedAt: DateTimeIsoString | null) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, usedAt });
  }

  withCreatedAt(createdAt: DateTimeIsoString) {
    return new OtpChallengeDtoBuilder({ ...this.#dto, createdAt });
  }

  build() {
    return this.#dto;
  }
}
