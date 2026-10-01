export type EmailButtonProps = {
  url: string;
  label: string;
  target?: "_blank" | "_self";
};

export const getButtonStyle = (index: number) =>
  `text-decoration: none; display: inline-block; padding: 10px 20px; text-align: center; ${
    index === 0
      ? "background-color: #000091; color: #fff;"
      : "border: #000091 1px solid; color: #000091;"
  }`;

export const renderButton = (params?: EmailButtonProps[]): string | undefined =>
  params &&
  (params.length > 0 ? true : undefined) &&
  `<table>
    ${params
      .map(
        ({ target, url, label }, index) =>
          `<tr>
              <td 
                align="center" 
                width="600"
                style="padding: 20px; padding-top: 10px; padding-bottom: ${
                  index === params.length - 1 ? "30px" : "10px"
                };"
              >
                <a
                  style="${getButtonStyle(index)}"
                  href="${url}"
                  ${target ? `target="${target}"` : ""}
                >
                  ${label}
                </a>
              </td>
          </tr>`,
      )
      .join("")}
  </table>`;
