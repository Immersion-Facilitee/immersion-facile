import { expect, type Locator, type Page } from "@playwright/test";
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
  conventionId?: ConventionId,
) => {
  await goToAdminTab(page, "adminNotifications");
  const emailSection = page
    .locator(
      conventionId
        ? `.im-email-info-container--convention-${conventionId}`
        : ".fr-accordion",
    )
    .filter({ hasText: emailType })
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
