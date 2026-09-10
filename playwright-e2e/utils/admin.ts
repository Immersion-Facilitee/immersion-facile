import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  type AdminTabRouteName,
  adminTabRouteNames,
  adminTabs,
  type BeneficiaryDashboardTab,
  domElementIds,
  type EmailType,
  type EstablishmentDashboardTab,
  frontRoutes,
} from "shared";
import { testConfig } from "../custom.config";
import { acceptCookiesIfBannerVisible } from "./utils";

export const goToAdminTab = async (page: Page, tabName: AdminTabRouteName) => {
  const adminButton = await page.locator("#fr-header-main-navigation-button-4");
  await expect(adminButton).toBeVisible();
  await adminButton.click();
  await page
    .locator(`#${domElementIds.header.navLinks.admin.backOffice}`)
    .click();
  await page.locator(".fr-tabs__tab").first().waitFor();
  const tabLocator = await page
    .locator(".fr-tabs__list li")
    .nth(getTabIndexByTabName(adminTabRouteNames, tabName))
    .locator(".fr-tabs__tab");
  await expect(tabLocator).toBeVisible();
  await tabLocator.click();
  expect(await page.url()).toContain(
    `${frontRoutes.admin().href}/${adminTabs[tabName].slug}`,
  );
};

const openEmailInAdmin = async (
  page: Page,
  emailType: EmailType,
  elementIndex = 0,
) => {
  await goToAdminTab(page, "adminNotifications");
  const emailSection = page
    .locator(`.fr-accordion:has-text("${emailType}")`)
    .nth(elementIndex);
  const locator = emailSection.locator(".fr-accordion__btn");
  await expect(locator).toBeVisible();
  await locator.click();
  return emailSection;
};

export const getMagicLinkLocatorFromEmail = async ({
  page,
  emailType,
  elementIndex = 0,
  label = "magicLink",
}: {
  page: Page;
  emailType: EmailType;
  elementIndex?: number;
  label?: string;
}): Promise<Locator> => {
  const emailWrapper = await openEmailInAdmin(page, emailType, elementIndex);
  return emailWrapper
    .locator("li")
    .filter({
      hasText: label,
    })
    .getByRole("link");
};

export const getMagicLinkAndRecipientFromEmail = async ({
  page,
  emailType,
  elementIndex = 0,
  label = "magicLink",
}: {
  page: Page;
  emailType: EmailType;
  elementIndex?: number;
  label?: string;
}): Promise<{ href: string | null; recipientEmail: string | null }> => {
  const emailWrapper = await openEmailInAdmin(page, emailType, elementIndex);
  const href = await emailWrapper
    .locator("li")
    .filter({
      hasText: label,
    })
    .getByRole("link")
    .getAttribute("href");
  const recipientsText = await emailWrapper
    .locator(".static-info-container")
    .filter({ hasText: "Destinataires" })
    .locator("div")
    .nth(1)
    .textContent();
  const recipientEmail = recipientsText?.split(",")[0]?.trim() || null;

  return { href, recipientEmail };
};

export const getMagicLinkFromEmail = async ({
  page,
  emailType,
  elementIndex = 0,
  label = "magicLink",
}: {
  page: Page;
  emailType: EmailType;
  elementIndex?: number;
  label?: string;
}): Promise<string | null> => {
  const locator = await getMagicLinkLocatorFromEmail({
    page,
    emailType,
    elementIndex,
    label,
  });
  return locator.getAttribute("href");
};

export const openConnectedConventionAsRecipient = async (
  adminPage: Page,
  href: string,
  recipientEmail: string,
): Promise<{ page: Page; context: BrowserContext }> => {
  const browser = adminPage.context().browser();
  if (!browser) throw new Error("Browser instance is not available");

  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto(href);
  await acceptCookiesIfBannerVisible(page);

  const byEmailButton = page.locator(
    `#${domElementIds.login.professional.byEmailButton}`,
  );
  await expect(byEmailButton).toBeVisible();
  await page.getByLabel("Email").fill(recipientEmail);
  await byEmailButton.click();
  await expect(
    page.getByRole("heading", {
      name: "Votre lien de connexion a bien été envoyé",
    }),
  ).toBeVisible();
  await page.waitForTimeout(testConfig.timeForEventCrawler);

  await adminPage.goto("/");
  const loginLink = await getMagicLinkFromEmail({
    page: adminPage,
    emailType: "LOGIN_BY_EMAIL_REQUESTED",
    elementIndex: 0,
    label: "loginLink",
  });
  if (!loginLink) throw new Error("Login by email link not found");

  await page.goto(loginLink);
  await page
    .getByRole("button", {
      name: "Oui, me connecter à Immersion Facilitée",
    })
    .click();
  await page.waitForURL(
    `**${frontRoutes.manageConventionConnectedUser({}).href}**`,
  );

  return { page, context };
};

export const getTabIndexByTabName = (
  tabList:
    | readonly AdminTabRouteName[]
    | readonly EstablishmentDashboardTab[]
    | readonly BeneficiaryDashboardTab[],
  tabName:
    | AdminTabRouteName
    | EstablishmentDashboardTab
    | BeneficiaryDashboardTab,
) => {
  const index = tabList.findIndex((tab) => tab === tabName);
  if (index === -1) {
    throw new Error(`Tab ${tabName} not found in adminTabs`);
  }
  return index;
};
