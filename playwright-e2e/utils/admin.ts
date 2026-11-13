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
  type ConventionId,
  domElementIds,
  type EmailType,
  type EstablishmentDashboardTab,
  frontRoutes,
} from "shared";
import { testConfig } from "../custom.config";
import { acceptCookiesIfBannerVisible } from "./utils";

export const goToAdminTab = async (page: Page, tabName: AdminTabRouteName) => {
  const adminLink = page.locator(
    `#${domElementIds.header.navLinks.admin.backOffice}`,
  );
  await expect(adminLink).toBeVisible();
  await adminLink.click();
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
  conventionId?: ConventionId,
  recipientEmail?: string,
) => {
  await goToAdminTab(page, "adminNotifications");
  const emailSection = page
    .locator(
      conventionId
        ? `.im-email-info-container--convention-${conventionId}`
        : ".fr-accordion",
    )
    .filter({ hasText: emailType })
    .filter({ hasText: recipientEmail })
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
  conventionId,
}: {
  conventionId?: ConventionId;
  page: Page;
  emailType: EmailType;
  elementIndex?: number;
  label?: string;
}): Promise<Locator> => {
  const emailWrapper = await openEmailInAdmin(
    page,
    emailType,
    elementIndex,
    conventionId,
  );
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
  conventionId,
}: {
  conventionId?: ConventionId;
  page: Page;
  emailType: EmailType;
  elementIndex?: number;
  label?: string;
}): Promise<{ href: string | null; recipientEmail: string | null }> => {
  const emailWrapper = await openEmailInAdmin(
    page,
    emailType,
    elementIndex,
    conventionId,
  );
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
  conventionId,
}: {
  conventionId?: ConventionId;
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
    conventionId,
  });
  return locator.getAttribute("href");
};

export const getOtpCodeFromEmail = async ({
  page,
  recipientEmail,
}: {
  page: Page;
  recipientEmail: string;
}): Promise<string | null> => {
  const emailWrapper = await openEmailInAdmin(
    page,
    "REQUEST_OTP_CODE",
    0,
    undefined,
    recipientEmail,
  );
  const otpCodeParamText = await emailWrapper
    .locator("li")
    .filter({ hasText: "otpCode" })
    .textContent();
  return otpCodeParamText?.match(/\d{6}/)?.[0] ?? null;
};

export const openConventionWithOtpAsRecipient = async (
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

  await page.locator(`#${domElementIds.otpChallenge.sendCodeButton}`).click();
  const otpCodeInput = page.locator(
    `#${domElementIds.otpChallenge.otpCodeInput}`,
  );
  await expect(otpCodeInput).toBeVisible();
  await page.waitForTimeout(testConfig.timeForEventCrawler);

  await adminPage.goto("/");
  const otpCode = await getOtpCodeFromEmail({
    page: adminPage,
    recipientEmail,
  });
  if (!otpCode) throw new Error("OTP code not found in email");

  await otpCodeInput.fill(otpCode);
  await expect(otpCodeInput).toBeHidden();

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
