import { expect, type Page, test } from "@playwright/test";
import { domElementIds, frontRoutes } from "shared";
import { acceptCookiesIfBannerVisible } from "../../utils/utils";

const personaRadioIndex = {
  beneficiary: 0,
  professional: 1,
} as const;

const loginPersonaRadio = (
  page: Page,
  persona: keyof typeof personaRadioIndex,
) =>
  page.locator(
    `#${domElementIds.loginPersona.radioButtons}-${personaRadioIndex[persona]}`,
  );

const selectLoginPersona = (
  page: Page,
  persona: keyof typeof personaRadioIndex,
) =>
  page
    .locator(
      `[for="${domElementIds.loginPersona.radioButtons}-${personaRadioIndex[persona]}"]`,
    )
    .click();

test.describe("Login page persona radio button", () => {
  test("shows no login method until a persona is picked, then reveals the matching one(s)", async ({
    page,
  }) => {
    await page.goto(frontRoutes.archivedConventionRequest().href);
    await acceptCookiesIfBannerVisible(page);

    await expect(loginPersonaRadio(page, "beneficiary")).not.toBeChecked();
    await expect(loginPersonaRadio(page, "professional")).not.toBeChecked();
    await expect(
      page.locator(`#${domElementIds.archivedConventionRequest.login.byEmailButton}`),
    ).toHaveCount(0);
    await expect(
      page.locator(
        `#${domElementIds.archivedConventionRequest.login.proConnectButton}`,
      ),
    ).toHaveCount(0);

    await selectLoginPersona(page, "beneficiary");
    await expect(
      page.locator(`#${domElementIds.archivedConventionRequest.login.byEmailButton}`),
    ).toBeVisible();
    await expect(
      page.locator(
        `#${domElementIds.archivedConventionRequest.login.proConnectButton}`,
      ),
    ).toHaveCount(0);

    await selectLoginPersona(page, "professional");
    await expect(
      page.locator(`#${domElementIds.archivedConventionRequest.login.byEmailButton}`),
    ).toBeVisible();
    await expect(
      page.locator(
        `#${domElementIds.archivedConventionRequest.login.proConnectButton}`,
      ),
    ).toBeVisible();
  });

  test("pre-selects the candidate persona and only shows email login on the beneficiary dashboard", async ({
    page,
  }) => {
    await page.goto(frontRoutes.beneficiaryDashboardDiscussions().href);
    await acceptCookiesIfBannerVisible(page);

    await expect(loginPersonaRadio(page, "beneficiary")).toBeChecked();
    await expect(loginPersonaRadio(page, "professional")).not.toBeChecked();
    await expect(
      page.locator(
        `#${domElementIds.beneficiaryDashboardDiscussions.login.byEmailButton}`,
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        `#${domElementIds.beneficiaryDashboardDiscussions.login.proConnectButton}`,
      ),
    ).toHaveCount(0);
  });
});
