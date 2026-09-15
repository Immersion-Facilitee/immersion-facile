import type { KeysOfUnion, ValueOf } from "../utils";
import type { Email, EmailAttachment } from "./email.dto";
import type { emailTemplatesByName } from "./emailTemplatesByName";

export type GenericTemplatedEmail<
  K extends string,
  P extends Record<string, unknown>,
> = {
  kind: K;
  params: P;
  sender?: {
    name: string;
    email: Email;
  };
  recipients?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: { name: string; email: Email };
  attachments?: EmailAttachment[];
};

export type EmailType = TemplatedEmail["kind"];

export type EmailVariables = KeysOfUnion<TemplatedEmail["params"]>;

export type EmailTemplatesByName = typeof emailTemplatesByName;

export type TemplatedEmail = ValueOf<{
  [TemplateName in keyof EmailTemplatesByName]: GenericTemplatedEmail<
    TemplateName,
    Parameters<EmailTemplatesByName[TemplateName]["createEmailVariables"]>[0]
  >;
}>;
