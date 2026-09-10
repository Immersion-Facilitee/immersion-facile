import { expect, type Page, test } from "@playwright/test";
import { domElementIds, frontRoutes } from "shared";
import { acceptCookiesIfBannerVisible } from "../../utils/utils";

type LoginPersona = "beneficiary" | "professional";

const personaRadioIndex: Record<LoginPersona, number> = {
  beneficiary: 0,
  professional: 1,
};

const loginPersonaRadio = (page: Page, persona: LoginPersona) =>
  page.locator(
    `#${domElementIds.login.radioButtons}-${personaRadioIndex[persona]}`,
  );

const selectLoginPersona = (page: Page, persona: LoginPersona) =>
  page
    .locator(
      `[for="${domElementIds.login.radioButtons}-${personaRadioIndex[persona]}"]`,
    )
    .click();

const expectNoLoginMethods = async (page: Page) => {
  await expect(
    page.locator(`#${domElementIds.login.beneficiary.byEmailButton}`),
  ).toHaveCount(0);
  await expect(
    page.locator(`#${domElementIds.login.beneficiary.proConnectButton}`),
  ).toHaveCount(0);
  await expect(
    page.locator(`#${domElementIds.login.professional.byEmailButton}`),
  ).toHaveCount(0);
  await expect(
    page.locator(`#${domElementIds.login.professional.proConnectButton}`),
  ).toHaveCount(0);
};

const expectBeneficiaryLoginMethods = async (page: Page) => {
  await expect(
    page.locator(`#${domElementIds.login.beneficiary.byEmailButton}`),
  ).toBeVisible();
  await expect(
    page.locator(`#${domElementIds.login.beneficiary.proConnectButton}`),
  ).toHaveCount(0);
};

const expectProfessionalLoginMethods = async (page: Page) => {
  await expect(
    page.locator(`#${domElementIds.login.professional.byEmailButton}`),
  ).toBeVisible();
  await expect(
    page.locator(`#${domElementIds.login.professional.proConnectButton}`),
  ).toBeVisible();
};

const expectSelectedLoginPersona = async (
  page: Page,
  persona: LoginPersona,
) => {
  const otherPersona: LoginPersona =
    persona === "beneficiary" ? "professional" : "beneficiary";

  await expect(loginPersonaRadio(page, persona)).toBeChecked();
  await expect(loginPersonaRadio(page, otherPersona)).not.toBeChecked();

  if (persona === "beneficiary") {
    await expectBeneficiaryLoginMethods(page);
    return;
  }

  await expectProfessionalLoginMethods(page);
};

test.describe("Login page persona radio button", () => {
  test("shows no login method until a persona is picked, then reveals the matching one(s)", async ({
    page,
  }) => {
    await page.goto(frontRoutes.archivedConventionRequest().href);
    await acceptCookiesIfBannerVisible(page);

    await expect(loginPersonaRadio(page, "beneficiary")).not.toBeChecked();
    await expect(loginPersonaRadio(page, "professional")).not.toBeChecked();
    await expectNoLoginMethods(page);

    await selectLoginPersona(page, "beneficiary");
    await expectSelectedLoginPersona(page, "beneficiary");

    await selectLoginPersona(page, "professional");
    await expectSelectedLoginPersona(page, "professional");
  });

  test("pre-selects the candidate persona and only shows email login on the beneficiary dashboard", async ({
    page,
  }) => {
    await page.goto(frontRoutes.beneficiaryDashboardDiscussions().href);
    await acceptCookiesIfBannerVisible(page);

    await expectSelectedLoginPersona(page, "beneficiary");
  });

  test("pre-selects the professional persona on the connected convention management page", async ({
    page,
  }) => {
    await page.goto(
      frontRoutes.manageConventionConnectedUser({
        conventionId: "00000000-0000-4000-8000-000000000001",
      }).href,
    );
    await acceptCookiesIfBannerVisible(page);

    await expectSelectedLoginPersona(page, "professional");
  });

  test("pre-selects the candidate persona when loginPersona=beneficiary is on the connected convention management page", async ({
    page,
  }) => {
    await page.goto(
      frontRoutes.manageConventionConnectedUser({
        conventionId: "00000000-0000-4000-8000-000000000001",
        loginPersona: "beneficiary",
      }).href,
    );
    await acceptCookiesIfBannerVisible(page);

    await expectSelectedLoginPersona(page, "beneficiary");
  });

  test("pre-selects the professional persona when loginPersona=professional is on the connected convention management page", async ({
    page,
  }) => {
    await page.goto(
      frontRoutes.manageConventionConnectedUser({
        conventionId: "00000000-0000-4000-8000-000000000001",
        loginPersona: "professional",
      }).href,
    );
    await acceptCookiesIfBannerVisible(page);

    await expectSelectedLoginPersona(page, "professional");
  });
});
