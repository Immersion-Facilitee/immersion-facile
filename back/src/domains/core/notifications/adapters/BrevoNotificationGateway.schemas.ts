import {
  type AbsoluteUrl,
  absoluteUrlSchema,
  type EmailAttachment,
  emailAttachmentSchema,
  emailSchema,
  localization,
  type PhoneNumber,
  smsRecipientPhoneSchema,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";

export type RecipientOrSender = {
  name?: string;
  email: string;
};
const recipientOrSenderSchema: ZodSchemaWithInputMatchingOutput<RecipientOrSender> =
  z.object({
    name: z.string().optional(),
    email: emailSchema,
  });

export type SendTransactEmailRequestBody = {
  to?: RecipientOrSender[];
  cc?: RecipientOrSender[];
  bcc?: RecipientOrSender[];
  replyTo?: RecipientOrSender;
  htmlContent: string;
  sender: RecipientOrSender;
  subject: string;
  tags?: string[];
  attachment?: EmailAttachment[];
};

export const sendTransactEmailRequestBodySchema: ZodSchemaWithInputMatchingOutput<SendTransactEmailRequestBody> =
  z.object({
    to: z.array(recipientOrSenderSchema).optional(),
    cc: z.array(recipientOrSenderSchema).optional(),
    bcc: z.array(recipientOrSenderSchema).optional(),
    replyTo: recipientOrSenderSchema.optional(),
    htmlContent: z.string(),
    sender: recipientOrSenderSchema,
    subject: z.string(),
    tags: z.array(z.string()).optional(),
    attachment: z.array(emailAttachmentSchema).optional(),
  });

export type SendTransactEmailResponseBody =
  | { messageId: string | number }
  | { messageIds: (string | number)[] };

export const sendTransactEmailResponseSchema: ZodSchemaWithInputMatchingOutput<SendTransactEmailResponseBody> =
  z
    .object({
      messageId: z.string().or(z.number()),
    })
    .or(
      z.object({
        messageIds: z.array(z.string().or(z.number())),
      }),
    );

export type SendTransactSmsRequestBody = {
  sender: string;
  recipient: PhoneNumber;
  content: string;
  type?: "transactional" | "marketing";
  tag?: string;
  organisationPrefix?: string;
  webUrl?: AbsoluteUrl;
  unicodeEnabled?: boolean;
};

const brevoSmsSenderSchema: ZodSchemaWithInputMatchingOutput<string> = z
  .string()
  .refine(
    (sender) =>
      ((/^[a-zA-Z0-9]+$/.test(sender) && sender.length <= 11) ||
        (/^[0-9]+$/.test(sender) && sender.length <= 15)) &&
      sender.length > 0,
    {
      message:
        "Invalid sender. It must have a maximum of 11 alphanumeric characters or a maximum of 15 numeric characters.",
    },
  );

export const sendTransactSmsRequestBodySchema: ZodSchemaWithInputMatchingOutput<SendTransactSmsRequestBody> =
  z.object({
    sender: brevoSmsSenderSchema,
    recipient: smsRecipientPhoneSchema,
    content: z.string(),
    type: z
      .enum(["transactional", "marketing"], {
        error: localization.invalidEnum,
      })
      .optional(),
    tag: z.string().optional(),
    organisationPrefix: z.string().optional(),
    webUrl: absoluteUrlSchema.optional(),
    unicodeEnabled: z.boolean().optional(),
  });

type SendTransactSmsResponseBody = {
  reference: string;
  messageId: number;
  smsCount?: number;
  usedCredits?: number;
  remainingCredits?: number;
};

export const sendTransactSmsResponseSchema: ZodSchemaWithInputMatchingOutput<SendTransactSmsResponseBody> =
  z.object({
    reference: z.string(),
    messageId: z.number(),
    smsCount: z.number().optional(),
    usedCredits: z.number().optional(),
    remainingCredits: z.number().optional(),
  });
