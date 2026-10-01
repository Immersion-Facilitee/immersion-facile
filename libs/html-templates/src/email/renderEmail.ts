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
import type { EmailVariables } from "./createEmailTemplate";
import { emailMarginInPx, renderEmailBlock } from "./emailBlock";

const doctype =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';

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
}): {
  subject: string;
  htmlContent: string;
  tags?: string[];
  attachment?: { url: string }[];
} => {
  const rows = [
    renderHTMLRow(renderHeader(agencyLogoUrl, customParts.header)),
    renderHTMLRow(renderGreetings(greetings), emailMarginInPx.md),
    ...blocks.map((block) =>
      renderHTMLRow(
        renderEmailBlock(block),
        emailMarginInPx[block.marginBottom ?? "md"],
      ),
    ),
    renderHTMLRow(renderSignature(signature)),
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

  const emailSupportedHtmlContent = htmlContent
    .replaceAll("href=", "\nhref=")
    .replaceAll("src=", "\nsrc=")
    .replaceAll("target=", "\ntarget=")
    .replaceAll("width=", "\nwidth=")
    .replaceAll("alt=", "\nalt=")
    .replaceAll("<br/>", "\n<br/>")
    .replaceAll("\n\n", "\n");

  return {
    subject,
    htmlContent: emailSupportedHtmlContent,
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
