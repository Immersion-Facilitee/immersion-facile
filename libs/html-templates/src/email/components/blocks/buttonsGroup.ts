import { match } from "ts-pattern";
import { type EmailButtonProps, renderButtonLink } from "./button";

export type EmailButtonsGroupLayout = "vertical" | "horizontal";

export type EmailButtonsGroupProps = {
  buttons: [EmailButtonProps, ...EmailButtonProps[]];
  layout?: EmailButtonsGroupLayout;
};

const buttonsGapInPx = 16;

const renderVerticalButtonsGroup = (buttons: EmailButtonProps[]): string =>
  `<table align="center">
    ${buttons
      .map(
        (button, index) =>
          `<tr>
            <td style="padding-bottom: ${index === buttons.length - 1 ? 0 : buttonsGapInPx}px;">
              ${renderButtonLink(button, "block")}
            </td>
          </tr>`,
      )
      .join("")}
  </table>`;

const renderHorizontalButtonsGroup = (buttons: EmailButtonProps[]): string =>
  `<table align="center">
    <tr>
      ${buttons
        .map(
          (button, index) =>
            `<td style="padding-left: ${index === 0 ? 0 : buttonsGapInPx / 2}px; padding-right: ${index === buttons.length - 1 ? 0 : buttonsGapInPx / 2}px;">
              ${renderButtonLink(button)}
            </td>`,
        )
        .join("")}
    </tr>
  </table>`;

export const renderButtonsGroup = ({
  buttons,
  layout = "vertical",
}: EmailButtonsGroupProps): string =>
  match(layout)
    .with("vertical", () => renderVerticalButtonsGroup(buttons))
    .with("horizontal", () => renderHorizontalButtonsGroup(buttons))
    .exhaustive();
