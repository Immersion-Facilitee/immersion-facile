import Bottleneck from "bottleneck";
import {
  cciCustomHtmlHeader,
  configureGenerateHtmlFromTemplate,
  defaultEmailFooter,
  type GenerateHtmlOptions,
} from "html-templates";
import {
  emailTemplatesByName,
  errors,
  type NotificationId,
  ONE_SECOND_MS,
  smsTemplatesByName,
  type TemplatedEmail,
  type TemplatedSms,
} from "shared";
import type { HttpClient } from "shared-routes";
import type { ApiKey, BrevoHeaders } from "../../../../utils/apiBrevoUrl";
import { createLogger } from "../../../../utils/logger";
import type {
  Base64,
  NotificationGateway,
  SendNotificationResult,
} from "../ports/NotificationGateway";
import type { BrevoNotificationGatewayRoutes } from "./BrevoNotificationGateway.routes";
import type {
  RecipientOrSender,
  SendTransactEmailRequestBody,
  SendTransactSmsRequestBody,
} from "./BrevoNotificationGateway.schemas";

const logger = createLogger(__filename);

// to keep align with Brevo Entreprise API limits : https://developers.brevo.com/docs/api-limits#enterprise-rate-limiting

const brevoMaxEmailRequestsPerSeconds = 2_000;
const brevoMaxSmsRequestsPerSeconds = 200;

// documentation https://developers.brevo.com/reference/sendtransacemail
export class BrevoNotificationGateway implements NotificationGateway {
  readonly #brevoHeaders: BrevoHeaders;

  #emailLimiter = new Bottleneck({
    reservoir: brevoMaxEmailRequestsPerSeconds,
    reservoirRefreshInterval: ONE_SECOND_MS, // number of ms
    reservoirRefreshAmount: brevoMaxEmailRequestsPerSeconds,
  });

  #smslimiter = new Bottleneck({
    reservoir: brevoMaxSmsRequestsPerSeconds,
    reservoirRefreshInterval: ONE_SECOND_MS, // number of ms
    reservoirRefreshAmount: brevoMaxSmsRequestsPerSeconds,
    minTime: 1000,
    maxConcurrent: 1,
  });

  constructor(
    private readonly config: {
      httpClient: HttpClient<BrevoNotificationGatewayRoutes>;
      emailAllowListPredicate: (recipient: string) => boolean;
      defaultSender: RecipientOrSender;
      generateHtmlOptions?: GenerateHtmlOptions;
    },
    apiKey: ApiKey,
  ) {
    this.#brevoHeaders = {
      accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    };
  }

  public async getAttachmentContent(
    downloadToken: string,
  ): Promise<Base64 | null> {
    const response = await this.config.httpClient.getAttachmentContent({
      urlParams: { downloadToken },
      headers: {
        accept: "application/octet-stream",
        "api-key": this.#brevoHeaders["api-key"],
      },
    });
    if (response.status !== 200)
      throw errors.generic.unsupportedStatus({
        body: JSON.stringify(response.body, null, 2),
        status: response.status,
        serviceName: "Brevo (getAttachementContent)",
      });
    if (!(response.body instanceof Blob)) {
      return null;
    }

    const blob: Blob = response.body;
    return Buffer.from(await blob.arrayBuffer()).toString("base64");
  }

  public async sendEmail(
    email: TemplatedEmail,
    notificationId?: NotificationId,
  ): Promise<SendNotificationResult> {
    if (!email.recipients?.length && !email.cc?.length && !email.bcc?.length)
      throw errors.notification.missingRecipient({ notificationId });

    const to = this.#filterAllowListAndConvertToRecipients(email.recipients);
    const cc = this.#filterAllowListAndConvertToRecipients(email.cc);
    const bcc = this.#filterAllowListAndConvertToRecipients(email.bcc);

    const emailData: SendTransactEmailRequestBody = {
      ...(to.length ? { to } : {}),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
      ...(email.attachments ? { attachment: email.attachments } : {}),
      ...configureGenerateHtmlFromTemplate(
        emailTemplatesByName,
        "internshipKind" in email.params &&
          email.params.internshipKind === "mini-stage-cci"
          ? {
              header: cciCustomHtmlHeader,
              footer: () => defaultEmailFooter("mini-stage-cci"),
            }
          : { footer: undefined, header: undefined },
      )(email.kind, email.params, this.config.generateHtmlOptions),
      sender: email.sender ?? this.config.defaultSender,
    };

    if (
      [
        ...(emailData.to ? emailData.to : []),
        ...(emailData.cc ? emailData.cc : []),
        ...(emailData.bcc ? emailData.bcc : []),
      ].length === 0
    )
      return { isOk: true, messageIds: [] };

    return this.#sendTransacEmail(emailData);
  }

  public sendSms(
    { kind, params, recipientPhone }: TemplatedSms,
    notificationId?: NotificationId,
  ): Promise<SendNotificationResult> {
    logger.info({
      notificationId,
      message: "sendTransactSmsTotal",
    });

    return this.#sendTransacSms({
      content: smsTemplatesByName[kind].createContent(params as any),
      sender: "ImmerFacile",
      recipient: recipientPhone,
    })
      .then((response) => {
        logger.info({
          notificationId,
          message: "sendTransactSmsSuccess",
        });
        return response;
      })
      .catch((error) => {
        logger.error({
          notificationId,
          message: "sendTransactSmsError",
        });
        return error;
      });
  }

  async #sendTransacEmail(
    body: SendTransactEmailRequestBody,
  ): Promise<SendNotificationResult> {
    return this.#emailLimiter.schedule(async () => {
      const response = await this.config.httpClient.sendTransactEmail({
        headers: this.#brevoHeaders,
        body,
      });

      if (response.status !== 201)
        return {
          isOk: false,
          error: {
            message: JSON.stringify(response.body),
            httpStatus: response.status,
          },
        };

      return {
        isOk: true,
        messageIds:
          "messageIds" in response.body
            ? response.body.messageIds
            : [response.body.messageId],
      };
    });
  }

  #sendTransacSms(
    body: SendTransactSmsRequestBody,
  ): Promise<SendNotificationResult> {
    return this.#smslimiter.schedule(async () => {
      const response = await this.config.httpClient.sendTransactSms({
        headers: this.#brevoHeaders,
        body,
      });

      if (response.status !== 201)
        return {
          isOk: false,
          error: {
            message: JSON.stringify(response.body),
            httpStatus: response.status,
          },
        };

      return {
        isOk: true,
        messageIds: [response.body.messageId],
      };
    });
  }

  #filterAllowListAndConvertToRecipients(
    emails: string[] = [],
  ): RecipientOrSender[] {
    return emails
      .filter(this.config.emailAllowListPredicate)
      .map((email) => ({ email }));
  }
}
