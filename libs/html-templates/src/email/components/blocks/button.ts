export type EmailButtonPriority = "primary" | "secondary" | "tertiary";

export type EmailButtonProps = {
  url: string;
  label: string;
  priority?: EmailButtonPriority;
};

const buttonColorsByPriority: Record<EmailButtonPriority, string> = {
  primary:
    "background-color: #000091; color: #f5f5fe; border: 1px solid #000091;",
  secondary:
    "background-color: transparent; color: #000091; border: 1px solid #000091;",
  tertiary:
    "background-color: transparent; color: #000091; border: 1px solid #dddddd;",
};

const getButtonStyle = (priority: EmailButtonPriority) =>
  `display: inline-block; padding: 7px 15px; font-size: 16px; line-height: 24px; font-weight: 500; text-align: center; text-decoration: none; background-image: none; ${buttonColorsByPriority[priority]}`;

export const renderButton = (params?: EmailButtonProps[]): string | undefined =>
  params &&
  (params.length > 0 ? true : undefined) &&
  `<table>
    ${params
      .map(
        ({ url, label, priority = "primary" }, index) =>
          `<tr>
              <td 
                align="center" 
                width="600"
                style="padding: 0 20px; padding-top: ${
                  index === 0 ? "0" : "10px"
                }; padding-bottom: ${index === params.length - 1 ? "0" : "10px"};"
              >
                <a
                  style="${getButtonStyle(priority)}"
                  href="${url}"
                  target="_blank"
                >
                  ${label}
                </a>
              </td>
          </tr>`,
      )
      .join("")}
  </table>`;
