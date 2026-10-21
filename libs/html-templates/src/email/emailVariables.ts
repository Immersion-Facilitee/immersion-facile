import type { EmailBlock } from "./emailBlock";

export type EmailVariables = {
  subject: string;
  agencyLogoUrl?: string;
  greetings?: string;
  blocks: EmailBlock[];
  signature?: string;
  legals?: string;
  attachmentUrls?: string[];
};

export type RawEmailVariables = {
  subject: string;
  rawContent: string;
};

export const isRawEmailVariables = (
  variables: EmailVariables | RawEmailVariables,
): variables is RawEmailVariables => "rawContent" in variables;
