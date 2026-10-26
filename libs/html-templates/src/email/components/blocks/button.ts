export type EmailButtonPriority = "primary" | "secondary" | "tertiary";

export type EmailButtonProps = {
  url: string;
  label: string;
  priority?: EmailButtonPriority;
};

export type EmailButtonDisplay = "inline-block" | "block";

const buttonColorsByPriority: Record<EmailButtonPriority, string> = {
  primary:
    "background-color: #000091; color: #f5f5fe; border: 1px solid #000091;",
  secondary:
    "background-color: transparent; color: #000091; border: 1px solid #000091;",
  tertiary:
    "background-color: transparent; color: #000091; border: 1px solid #dddddd;",
};

const getButtonStyle = (
  priority: EmailButtonPriority,
  display: EmailButtonDisplay,
) =>
  `display: ${display}; padding: 7px 15px; font-size: 16px; line-height: 24px; font-weight: 500; text-align: center; text-decoration: none; background-image: none; ${buttonColorsByPriority[priority]}`;

export const renderButtonLink = (
  { url, label, priority = "primary" }: EmailButtonProps,
  display: EmailButtonDisplay = "inline-block",
): string =>
  `<a
    style="${getButtonStyle(priority, display)}"
    href="${url}"
    target="_blank"
  >
    ${label}
  </a>`;

export const renderButton = (button: EmailButtonProps): string =>
  `<table width="100%">
    <tr>
      <td align="center">
        ${renderButtonLink(button)}
      </td>
    </tr>
  </table>`;
