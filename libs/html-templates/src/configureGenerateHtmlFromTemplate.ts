import {
  renderButton,
  renderContent,
  renderFooter,
  renderGreetings,
  renderHead,
  renderHeader,
  renderHighlight,
  renderLegals,
} from "./components/email";
import { renderHighlightContentWithCTA } from "./components/email/highlightContentWithCTA";
import type { HtmlTemplateEmailData } from "./createTemplatesByName";
import { ignoreTabs } from "./helpers/formatters";

type Attachement = { url: string } | { name: string; content: string };

const emailReplySeparator =
  "##- Veuillez répondre au-dessus de cette ligne -##";

export type GenerateHtmlOptions = {
  skipHead?: boolean;
  showContentParts?: boolean;
};

const renderHTMLRow = (html: string | undefined) =>
  html && html !== ""
    ? `
    <tr>
      <td>
        ${html}
      </td>
    </tr>
  `
    : "";

export const configureGenerateHtmlFromTemplate =
  <TemplateByName extends Record<string, HtmlTemplateEmailData<any>>>(
    templateByName: TemplateByName,
    customParts: {
      header: ((agencyLogoUrl?: string) => string) | undefined;
      footer: (() => string) | undefined;
    },
  ) =>
  <N extends keyof TemplateByName>(
    templateName: N,
    params: Parameters<TemplateByName[N]["createEmailVariables"]>[0],
    options: GenerateHtmlOptions = {},
  ): {
    subject: string;
    htmlContent: string;
    contentParts?: {
      header: string | undefined;
      greetings: string | undefined;
      content: string | undefined;
      buttons: string | undefined;
      highlight: string | undefined;
      subContent: string | undefined;
      legals: string | undefined;
      footer: string | undefined;
    };
    tags?: string[];
    attachment?: Attachement[];
  } => {
    const { createEmailVariables, tags } = templateByName[templateName];
    const {
      subject,
      agencyLogoUrl,
      greetings,
      content,
      buttons,
      highlight,
      subContent,
      legals,
      attachmentUrls,
      bypassLayout,
      highlightContentWithCTA,
    } = createEmailVariables(params as any);

    const doctype =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';

    const replyHeaderStyle =
      "color: #b5b5b5; font-size: 12px; margin-bottom: 12px;";
    const replyHeader = `
        <p style="${replyHeaderStyle}">${emailReplySeparator}</p>
        <p style="${replyHeaderStyle}">Cet email vous a été envoyé via le service Immersion Facilitée, vous pouvez répondre directement à cet email, il sera transmis à votre interlocuteur.</p>
        <p style="${replyHeaderStyle}">-----------------------------</p>`;
    const contentParts = {
      header: renderHeader(agencyLogoUrl, customParts.header),
      greetings: renderGreetings(greetings),
      content: renderContent(content),
      buttons: renderButton(buttons),
      highlight: renderHighlight(highlight),
      highlightContentWithCTA: renderHighlightContentWithCTA(
        highlightContentWithCTA,
      ),
      subContent: renderContent(subContent),
      legals: renderLegals(legals),
      footer: renderFooter(customParts.footer),
    };
    const htmlContent = bypassLayout
      ? ignoreTabs(`
        ${replyHeader}
        
        ${content ?? "Pas de contenu"}
      `)
      : ignoreTabs(
          `${options.skipHead ? "" : doctype}
        <html lang="fr">${options.skipHead ? "" : renderHead(subject)}
          <body>
            <table width="600" align="center" style="margin-top: 20px">
              ${Object.values(contentParts).map(renderHTMLRow).join("")}       
            </table>
          </body>
        </html>
      `,
        );

    const emailSupportedHtmlConcent = htmlContent
      .replaceAll("href=", "\nhref=")
      .replaceAll("src=", "\nsrc=")
      .replaceAll("target=", "\ntarget=")
      .replaceAll("width=", "\nwidth=")
      .replaceAll("alt=", "\nalt=")
      .replaceAll("<br/>", "\n<br/>")
      .replaceAll("\n\n", "\n");

    return {
      subject,
      htmlContent: emailSupportedHtmlConcent,
      ...(options.showContentParts ? { contentParts } : {}),
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
