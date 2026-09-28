import { expect, type Page } from "@playwright/test";
import { domElementIds, frontRoutes, SEED_FT_AGENCY_ID } from "shared";
import { testConfig } from "../../custom.config";
import { goToAdminTab } from "../../utils/admin";
import { fillAutocomplete, test } from "../../utils/utils";

test.describe.configure({ mode: "serial" });

const newAgencyUserEmail = testConfig.proConnect.username;

const goToMyAgencies = async (page: Page) => {
  await page.goto(frontRoutes.agencyDashboardAgencies().href);
};

const agencyRightsModal = (page: Page) =>
  page
    .locator(`#${domElementIds.agencyDashboard.agencyTab.adminRightsModal}`)
    .or(
      page.locator(
        `#${domElementIds.agencyDashboard.agencyTab.userRightsModal}`,
      ),
    );

const goToFtAgencyAdminTabFromHome = async (page: Page) => {
  await page.goto("/");
  await goToAdminTab(page, "adminAgencies");
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.admin.agencyTab.editAgencyAutocompleteInput}`,
    value: "Agence France Travail Paris",
  });
  await expect(
    page.locator(`#${domElementIds.admin.agencyTab.agencyUsersTable}`),
  ).toBeVisible();
};

const removeNewAgencyUserIfPresent = async (page: Page) => {
  const newUserRow = page.locator("tr").filter({ hasText: newAgencyUserEmail });
  if (!(await newUserRow.isVisible())) return;

  await newUserRow
    .locator(
      `[id^=${domElementIds.admin.agencyTab.editAgencyRemoveUserButton}]`,
    )
    .click();

  await expect(
    page.locator(`#${domElementIds.admin.agencyTab.editAgencyRemoveUserModal}`),
  ).toBeVisible();

  await page
    .locator(
      `[id^=${domElementIds.admin.agencyTab.editAgencyRemoveUserConfirmationButton}]`,
    )
    .click();

  await expect(page.locator(".fr-alert--success").first()).toBeVisible();
};

test.describe("Agency rights workflow", () => {
  test.describe("Backoffice admin", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test("can update its own agency rights from agency dashboard", async ({
      page,
    }) => {
      await goToMyAgencies(page);

      await page
        .locator(
          `[id^=${domElementIds.agencyDashboard.agencyTab.editRoleButton}]`,
        )
        .first()
        .click();
      await expect(agencyRightsModal(page)).toBeVisible();
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserEmail}`,
        ),
      ).toBeDisabled();
      await page
        .locator(
          `[for="${domElementIds.agencyDashboard.agencyTab.editAgencyManageUserCheckbox}-3"]`,
        )
        .click();
      await page
        .locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserRoleSubmitButton}`,
        )
        .click();
      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
    });

    test("create a user with agency-admin and validator rights for agency", async ({
      page,
    }) => {
      await goToFtAgencyAdminTabFromHome(page);
      await removeNewAgencyUserIfPresent(page);

      await page
        .locator(
          `[id^=${domElementIds.admin.agencyTab.openManageUserModalButton}]`,
        )
        .click();

      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`,
        ),
      ).toBeVisible();
      await page.fill(
        `#${domElementIds.admin.agencyTab.editAgencyUserEmail}`,
        newAgencyUserEmail,
      );
      await page
        .locator(
          `[for="${domElementIds.admin.agencyTab.editAgencyManageUserCheckbox}-0"]`,
        )
        .click();
      await page
        .locator(
          `[for="${domElementIds.admin.agencyTab.editAgencyManageUserCheckbox}-1"]`,
        )
        .click();
      await page
        .locator(
          `#${domElementIds.admin.agencyTab.editAgencyUserRoleSubmitButton}`,
        )
        .click();

      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
    });
  });

  test.describe("IC user", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("can remove its own agency-admin right", async ({ page }) => {
      await goToMyAgencies(page);

      const ftAgencyEditRoleButton = page.locator(
        `#${domElementIds.agencyDashboard.agencyTab.editRoleButton}-${SEED_FT_AGENCY_ID}`,
      );
      const isAlreadyBasicAgencyUser = await ftAgencyEditRoleButton
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => false)
        .catch(() => true);
      if (isAlreadyBasicAgencyUser) return;
      await ftAgencyEditRoleButton.click();
      await expect(agencyRightsModal(page)).toBeVisible();
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserEmail}`,
        ),
      ).toBeDisabled();
      await page
        .locator(
          `[for="${domElementIds.agencyDashboard.agencyTab.editAgencyManageUserCheckbox}-0"]`,
        )
        .click();
      await page
        .locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserRoleSubmitButton}`,
        )
        .click();
      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
    });

    test("can only update its notification preferences when not agency-admin", async ({
      page,
    }) => {
      await goToMyAgencies(page);

      await expect(
        page.locator(
          `[id^=${domElementIds.agencyDashboard.agencyTab.adminAgencyLink}]`,
        ),
      ).toHaveCount(0);

      await page
        .locator(
          `[id^=${domElementIds.agencyDashboard.agencyTab.editRoleButton}]`,
        )
        .first()
        .click();
      await expect(agencyRightsModal(page)).toBeVisible();
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserEmail}`,
        ),
      ).toBeDisabled();
      const roleOptionsCount = await page
        .locator(
          `input[id^=${domElementIds.agencyDashboard.agencyTab.editAgencyManageUserCheckbox}]`,
        )
        .count();

      for (let i = 0; i < roleOptionsCount; i++) {
        await expect(
          page.locator(
            `[for="${domElementIds.agencyDashboard.agencyTab.editAgencyManageUserCheckbox}-${i}"]`,
          ),
        ).toBeDisabled();
      }

      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.agencyTab.editAgencyUserIsNotifiedByEmail}`,
        ),
      ).toBeEnabled();
    });
  });

  test.describe("Reset", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test("removes IC user from FT agency", async ({ page }) => {
      await goToFtAgencyAdminTabFromHome(page);
      await removeNewAgencyUserIfPresent(page);
    });
  });
});
