import { expect } from "@playwright/test";
import { domElementIds, SEED_ADMIN_BENEFICIARY_CONVENTION_ID } from "shared";
import { testConfig } from "../../custom.config";
import {
  goToBeneficiaryDashboardTab,
  goToDashboard,
} from "../../utils/dashboard";
import {
  acceptCookiesIfBannerVisible,
  expectLocatorToBeVisibleAndEnabled,
  test,
} from "../../utils/utils";

test.describe.configure({ mode: "serial" });

test.describe("Beneficiary dashboard workflow", () => {
  test.describe("Beneficiary Convention List with conventions", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test("should be able to navigate to beneficiary convention list and have one convention in list", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "candidate");
      await expectLocatorToBeVisibleAndEnabled(page.locator(".fr-tabs__list"));
      await goToBeneficiaryDashboardTab(page, "conventions");
      await expect(page.locator("table tbody tr")).toHaveCount(1);
    });

    test("should open convention manage page from the list", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "candidate");
      await expectLocatorToBeVisibleAndEnabled(page.locator(".fr-tabs__list"));
      await goToBeneficiaryDashboardTab(page, "conventions");
      await expect(
        page.getByRole("heading", { name: "Conventions" }),
      ).toBeVisible();

      const goToConventionButton = page.locator(
        `#${domElementIds.beneficiaryDashboardConventions.goToConventionButton}--${SEED_ADMIN_BENEFICIARY_CONVENTION_ID}`,
      );
      await expect(goToConventionButton).toBeVisible();
      const [manageConventionPage] = await Promise.all([
        page.context().waitForEvent("page"),
        goToConventionButton.click(),
      ]);
      await acceptCookiesIfBannerVisible(manageConventionPage);

      await expect(
        manageConventionPage.locator(
          `#${domElementIds.manageConvention.openDocumentButton}`,
        ),
      ).toBeVisible();
      await manageConventionPage.close();
    });
  });

  test.describe("Beneficiary Convention List without conventions", () => {
    test.use({ storageState: testConfig.establishmentAuthFile });
    test("should be able to navigate to beneficiary convention list and show no convention message", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "candidate");
      await expectLocatorToBeVisibleAndEnabled(page.locator(".fr-tabs__list"));
      await goToBeneficiaryDashboardTab(page, "conventions");
      await expect(
        page.locator(
          `#${
            domElementIds.beneficiaryDashboardConventions
              .beneficiaryConventionListHelpdeskNoConventionHint
          }`,
        ),
      ).toBeVisible();
    });
  });
});
