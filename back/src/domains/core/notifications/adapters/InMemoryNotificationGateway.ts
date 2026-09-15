import { prop } from "ramda";
import {
  type DateString,
  errors,
  type NotificationId,
  type TemplatedEmail,
  type TemplatedSms,
} from "shared";
import { CustomTimeGateway } from "../../time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../time-gateway/ports/TimeGateway";
import type {
  Base64,
  NotificationGateway,
  SendNotificationResult,
} from "../ports/NotificationGateway";

export const sendSmsError555PhoneNumber = "0699000555";
export const sendSmsError400PhoneNumber = "0699000400";
export const emailThatTriggerSendEmailError400 =
  "email-that-triggers-send-email-error-400@mail.com";
export const fakeHttpStatus555ErrorCode = 555;
export const fakeHttpStatus400ErrorCode = 400;

export class InMemoryNotificationGateway implements NotificationGateway {
  public attachmentsByLinks: Partial<Record<string, Base64>> = {
    default: "",
  };

  readonly #sentEmails: {
    templatedEmail: TemplatedEmail;
    sentAt: DateString;
  }[] = [];

  readonly #sentSms: TemplatedSms[] = [];

  constructor(
    private readonly timeGateway: TimeGateway = new CustomTimeGateway(),
    private readonly numberOfEmailToKeep: number | null = null,
  ) {}

  public async getAttachmentContent(link: string): Promise<Base64 | null> {
    const attachment = this.attachmentsByLinks[link];
    if (!attachment)
      throw errors.generic.fakeError(`No attachment found by link ${link}.`);
    if (attachment === "not-a-blob") return null;
    return attachment;
  }

  // For testing.
  public getSentEmails(): TemplatedEmail[] {
    return this.#sentEmails.map(prop("templatedEmail"));
  }

  public getSentSms(): TemplatedSms[] {
    return this.#sentSms;
  }

  public async sendEmail(
    templatedEmail: TemplatedEmail,
    notificationId?: NotificationId,
  ): Promise<SendNotificationResult> {
    if (
      templatedEmail.recipients?.includes(emailThatTriggerSendEmailError400)
    ) {
      return {
        isOk: false,
        error: {
          message: `fake Send Email Error with email ${emailThatTriggerSendEmailError400}`,
          httpStatus: fakeHttpStatus400ErrorCode,
        },
      };
    }
    if (
      !templatedEmail.recipients?.length &&
      !templatedEmail.cc?.length &&
      !templatedEmail.bcc?.length
    )
      throw errors.notification.missingRecipient({ notificationId });
    this.#pushEmail(templatedEmail);
    return {
      isOk: true,
      messageIds: [
        ...(templatedEmail.recipients ?? []),
        ...(templatedEmail.cc ?? []),
        ...(templatedEmail.bcc ?? []),
      ],
    };
  }

  public async sendSms(sms: TemplatedSms): Promise<SendNotificationResult> {
    if (sms.recipientPhone === `33${sendSmsError555PhoneNumber.substring(1)}`) {
      return {
        isOk: false,
        error: {
          message: `fake Send SMS Error with phone number ${sms.recipientPhone}.`,
          httpStatus: fakeHttpStatus555ErrorCode,
        },
      };
    }

    if (sms.recipientPhone === `33${sendSmsError400PhoneNumber.substring(1)}`) {
      return {
        isOk: false,
        error: {
          message: `fake Send SMS Error with phone number ${sms.recipientPhone}.`,
          httpStatus: fakeHttpStatus400ErrorCode,
        },
      };
    }

    this.#sentSms.push(sms);
    return { isOk: true, messageIds: [sms.recipientPhone] };
  }

  #pushEmail(templatedEmail: TemplatedEmail) {
    const numberOfEmailsToDrop = this.numberOfEmailToKeep
      ? this.#sentEmails.length + 1 - this.numberOfEmailToKeep
      : 0;

    if (numberOfEmailsToDrop > 0) {
      this.#sentEmails.splice(0, numberOfEmailsToDrop);
    }

    this.#sentEmails.push({
      templatedEmail,
      sentAt: this.timeGateway.now().toISOString(),
    });
  }
}
