import { expect, type Page } from "@playwright/test";
import { domElementIds, SEED_FT_AGENCY_ID } from "shared";
import { testConfig } from "../../custom.config";
import { goToAdminTab } from "../../utils/admin";
import { fillAutocomplete, test } from "../../utils/utils";

test.describe.configure({ mode: "serial" });

const newAgencyUserEmail = testConfig.proConnect.username;

const goToMyProfilePageFromHome = async (page: Page) => {
  await page.goto("/");
  await page.locator("#fr-header-quick-access-item-1").click();
};

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

test.describe("User workflow", () => {
  test.describe("Backoffice admin can go to MyProfile page", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test("can access infos on MyProfile page", async ({ page }) => {
      await goToMyProfilePageFromHome(page);

      const agenciesCount = await page
        .locator(`[id^=${domElementIds.myAccount.editRoleButton}]`)
        .count();
      await expect(
        page.locator(`[id^=${domElementIds.myAccount.adminAgencyLink}]`),
      ).toHaveCount(agenciesCount);

      await page
        .locator(`[id^=${domElementIds.myAccount.editRoleButton}]`)
        .first()
        .click();
      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`,
        ),
      ).toBeVisible();
      await expect(
        page.locator(`#${domElementIds.myAccount.editAgencyUserEmail}`),
      ).toBeDisabled();
      await page
        .locator(
          `[for="${domElementIds.myAccount.editAgencyManageUserCheckbox}-3"]`,
        )
        .click();
      await page
        .locator(`#${domElementIds.myAccount.editAgencyUserRoleSubmitButton}`)
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

  test.describe("Agency-admin user can go to MyProfile page", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("can access infos on MyProfile page", async ({ page }) => {
      await goToMyProfilePageFromHome(page);

      await expect(
        page.locator(`[id^=${domElementIds.myAccount.adminAgencyLink}]`),
      ).toHaveCount(0);
      await expect(
        page.locator(`[id^=${domElementIds.myAccount.editRoleButton}]`).first(),
      ).toBeVisible();
    });

    test("can remove its own agency-admin right", async ({ page }) => {
      await goToMyProfilePageFromHome(page);

      const ftAgencyEditRoleButton = page.locator(
        `#${domElementIds.myAccount.editRoleButton}-${SEED_FT_AGENCY_ID}`,
      );
      const isAlreadyBasicAgencyUser = await ftAgencyEditRoleButton
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => false)
        .catch(() => true);
      if (isAlreadyBasicAgencyUser) {
        await expect(
          page.locator(`#${domElementIds.myAccount.updateOwnInfosLink}`),
        ).toBeVisible();
        return;
      }
      await ftAgencyEditRoleButton.click();
      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`,
        ),
      ).toBeVisible();
      await expect(
        page.locator(`#${domElementIds.myAccount.editAgencyUserEmail}`),
      ).toBeDisabled();
      await page
        .locator(
          `[for="${domElementIds.myAccount.editAgencyManageUserCheckbox}-0"]`,
        )
        .click();
      await page
        .locator(`#${domElementIds.myAccount.editAgencyUserRoleSubmitButton}`)
        .click();
      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
    });
  });

  test.describe("Basic agency user can go to MyProfile page", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("can access infos on MyProfile page", async ({ page }) => {
      await goToMyProfilePageFromHome(page);

      await expect(
        page.locator(`#${domElementIds.myAccount.updateOwnInfosLink}`),
      ).toBeVisible();
      await expect(
        page.locator(`[id^=${domElementIds.myAccount.adminAgencyLink}]`),
      ).toHaveCount(0);
    });

    test("can request to register on agencies from MyProfile page", async ({
      page,
    }) => {
      await goToMyProfilePageFromHome(page);

      await expect(
        page.locator(`#${domElementIds.myAccount.registerAgenciesSearchLink}`),
      ).toBeVisible();
      await page
        .locator(`#${domElementIds.myAccount.registerAgenciesSearchLink}`)
        .click();

      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.registerAgencies.search}`,
        ),
      ).toBeVisible();
      await page
        .locator(`#${domElementIds.agencyDashboard.registerAgencies.search}`)
        .fill("Cap emploi");

      const checkbox = await page
        .locator(
          `#${domElementIds.agencyDashboard.registerAgencies.table} table tbody tr .fr-checkbox-group`,
        )
        .first();
      await expect(checkbox).toBeVisible();
      await checkbox.click();

      await page
        .locator(
          `#${domElementIds.agencyDashboard.registerAgencies.submitButton}`,
        )
        .click();

      await expect(
        await page.locator(".fr-alert--success").first(),
      ).toBeVisible();
    });

    test("has access to his notification preferences", async ({ page }) => {
      await goToMyProfilePageFromHome(page);

      await page
        .locator(`[id^=${domElementIds.myAccount.editRoleButton}]`)
        .first()
        .click();
      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`,
        ),
      ).toBeVisible();
      await expect(
        page.locator(`#${domElementIds.myAccount.editAgencyUserEmail}`),
      ).toBeDisabled();
      const roleOptionsCount = await page
        .locator(
          `input[id^=${domElementIds.myAccount.editAgencyManageUserCheckbox}]`,
        )
        .count();

      for (let i = 0; i < roleOptionsCount; i++) {
        await expect(
          page.locator(
            `[for="${domElementIds.myAccount.editAgencyManageUserCheckbox}-${i}"]`,
          ),
        ).toBeDisabled();
      }

      await expect(
        page.locator(
          `#${domElementIds.myAccount.editAgencyUserIsNotifiedByEmail}`,
        ),
      ).toBeEnabled();
    });
  });

  test.describe("Reset", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test("Remove new user from agency", async ({ page }) => {
      await goToFtAgencyAdminTabFromHome(page);
      await removeNewAgencyUserIfPresent(page);
    });
  });
});
