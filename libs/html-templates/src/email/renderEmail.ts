import type { GenerateHtmlOptions } from "../configureGenerateHtmlFromTemplate";
import { ignoreTabs } from "../helpers/formatters";
import {
  renderFooter,
  renderGreetings,
  renderHead,
  renderHeader,
  renderLegals,
  renderSignature,
} from "./components";
import {
  type EmailBlock,
  emailMarginInPx,
  renderEmailBlock,
} from "./emailBlock";
import type { EmailVariables, RawEmailVariables } from "./emailVariables";

export type EmailContentParts = {
  greetings: string | undefined;
  contentWithoutButtons: string;
  signature: string | undefined;
};

export type RenderedEmail = {
  subject: string;
  htmlContent: string;
  contentParts?: EmailContentParts;
  tags?: string[];
  attachment?: { url: string }[];
};

const doctype =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';

const emailReplySeparator =
  "##- Veuillez répondre au-dessus de cette ligne -##";

const replyHeaderStyle =
  "color: #b5b5b5; font-size: 12px; margin-bottom: 12px;";

const replyHeader = `
        <p style="${replyHeaderStyle}">${emailReplySeparator}</p>
        <p style="${replyHeaderStyle}">Cet email vous a été envoyé via le service Immersion Facilitée, vous pouvez répondre directement à cet email, il sera transmis à votre interlocuteur.</p>
        <p style="${replyHeaderStyle}">-----------------------------</p>`;

const renderHTMLRow = (html: string | undefined, paddingBottomInPx?: number) =>
  html && html !== ""
    ? `
    <tr>
      <td${paddingBottomInPx ? ` style="padding-bottom: ${paddingBottomInPx}px;"` : ""}>
        ${html}
      </td>
    </tr>
  `
    : "";

const isButtonBlock = (block: EmailBlock): boolean =>
  block.kind === "button" || block.kind === "buttonsGroup";

const toEmailSupportedHtml = (htmlContent: string): string =>
  htmlContent
    .replaceAll("href=", "\nhref=")
    .replaceAll("src=", "\nsrc=")
    .replaceAll("target=", "\ntarget=")
    .replaceAll("width=", "\nwidth=")
    .replaceAll("alt=", "\nalt=")
    .replaceAll("<br/>", "\n<br/>")
    .replaceAll("\n\n", "\n");

export const renderRawEmail = ({
  emailVariables: { subject, rawContent },
  tags,
}: {
  emailVariables: RawEmailVariables;
  tags: string[] | undefined;
}): RenderedEmail => ({
  subject,
  htmlContent: toEmailSupportedHtml(
    ignoreTabs(`
        ${replyHeader}

        ${rawContent}
      `),
  ),
  ...(tags ? { tags } : {}),
});

export const renderEmail = ({
  emailVariables: {
    subject,
    agencyLogoUrl,
    greetings,
    blocks,
    signature,
    legals,
    attachmentUrls,
  },
  tags,
  customParts,
  options,
}: {
  emailVariables: EmailVariables;
  tags: string[] | undefined;
  customParts: {
    header: ((agencyLogoUrl?: string) => string) | undefined;
    footer: (() => string) | undefined;
  };
  options: GenerateHtmlOptions;
}): RenderedEmail => {
  const renderedGreetings = renderGreetings(greetings);
  const renderedSignature = signature && renderSignature(signature);

  const rows = [
    renderHTMLRow(renderHeader(agencyLogoUrl, customParts.header)),
    renderHTMLRow(renderedGreetings, emailMarginInPx.md),
    ...blocks.map((block) =>
      renderHTMLRow(
        renderEmailBlock(block),
        emailMarginInPx[block.marginBottom ?? "md"],
      ),
    ),
    renderHTMLRow(renderedSignature),
    renderHTMLRow(renderLegals(legals)),
    renderHTMLRow(renderFooter(customParts.footer)),
  ];

  const htmlContent = ignoreTabs(
    `${options.skipHead ? "" : doctype}
    <html lang="fr">${options.skipHead ? "" : renderHead(subject)}
      <body>
        <table width="600" align="center" style="margin-top: 20px">
          ${rows.join("")}
        </table>
      </body>
    </html>
  `,
  );

  return {
    subject,
    htmlContent: toEmailSupportedHtml(htmlContent),
    ...(options.showContentParts
      ? {
          contentParts: {
            greetings: renderedGreetings,
            contentWithoutButtons: blocks
              .filter((block) => !isButtonBlock(block))
              .map(renderEmailBlock)
              .join("\n"),
            signature: renderedSignature,
          },
        }
      : {}),
    ...(tags ? { tags } : {}),
    ...(attachmentUrls
      ? {
          attachment: attachmentUrls.map((attachmentUrl) => ({
            url: attachmentUrl,
          })),
        }
      : {}),
  };
};
