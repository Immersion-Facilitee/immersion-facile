import { faker } from "@faker-js/faker";
import { expect, type Page } from "@playwright/test";
import {
  type AgencyId,
  domElementIds,
  frontRoutes,
  SEED_FT_AGENCY_ID,
} from "shared";
import { testConfig } from "../../custom.config";
import { goToAdminTab } from "../../utils/admin";
import { fillAndSubmitBasicAgencyForm } from "../../utils/agency";
import {
  createConventionTemplate,
  deleteConventionTemplate,
  goToDashboard,
  initiateConvention,
} from "../../utils/dashboard";
import { e2eSiretAgencies } from "../../utils/siret";
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
    )
    .filter({ visible: true });

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

test.describe("Agency dashboard workflow", () => {
  let agencyId: AgencyId | null = null;
  const agencySiret = e2eSiretAgencies.dashboard;

  test.describe("Agency rights by backoffice admin", () => {
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

  test.describe("Agency rights by IC user", () => {
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

  test.describe("Agency rights reset", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test("removes IC user from FT agency", async ({ page }) => {
      await goToFtAgencyAdminTabFromHome(page);
      await removeNewAgencyUserIfPresent(page);
    });
  });

  test.describe("Agency creation", () => {
    test.use({ storageState: testConfig.agencyAuthFile });
    test("creates a new agency", async ({ page }) => {
      agencyId = await fillAndSubmitBasicAgencyForm(page, {
        siret: agencySiret,
        customizedName: "Handicap emploi !",
        rawAddress: "1 Avenue Jean-Marie Verne 01000 Bourg-en-Bresse",
      });
      await expect(
        page
          .locator(".fr-alert--success")
          .or(page.locator(".fr-alert--error").filter({ hasText: /existe/i })),
      ).toBeVisible();
      await expect(agencyId).not.toBeNull();
    });
  });
  test.describe("Agency activation by admin", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test("activate agency in admin", async ({ page }) => {
      if (!agencyId) throw new Error("Agency ID is null");
      await page.goto("/");
      await goToAdminTab(page, "adminAgencies");
      await fillAutocomplete({
        page,
        locator: `#${domElementIds.admin.agencyTab.editAgencyAutocompleteInput}`,
        value: agencySiret,
      });

      await page
        .locator(`#${domElementIds.admin.agencyTab.openManageUserModalButton}`)
        .click();
      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`,
        ),
      ).toBeVisible();
      await page
        .locator(`#${domElementIds.admin.agencyTab.editAgencyUserEmail}`)
        .fill(faker.internet.email());
      await page
        .locator(
          `[for="${domElementIds.admin.agencyTab.editAgencyManageUserCheckbox}-0"]`,
        )
        .click();
      await page
        .locator(
          `#${domElementIds.admin.agencyTab.editAgencyUserRoleSubmitButton}`,
        )
        .click();
      await expect(page.locator(".fr-alert--success").first()).toBeVisible();

      const statusSelector = page.locator(
        `#${domElementIds.admin.agencyTab.editAgencyFormStatusSelector}`,
      );
      await expect(statusSelector).toBeVisible();
      await statusSelector.selectOption("active");

      await page
        .locator(
          `#${domElementIds.admin.agencyTab.editAgencyFormEditSubmitButton}`,
        )
        .click();

      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
      await page.waitForTimeout(testConfig.timeForEventCrawler);
    });
  });
  test.describe("Agency registration by Ic user", () => {
    const registeredAgencyCount = 2;

    test.use({ storageState: testConfig.agencyAuthFile });
    test("an Ic user should be able to ask to be registered to an agency", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "agency");
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.registerAgencies.search}`,
        ),
      ).toBeVisible();
      await page
        .locator(`#${domElementIds.agencyDashboard.registerAgencies.search}`)
        .fill("conseil-departemental");

      for (const index of [...Array(registeredAgencyCount).keys()]) {
        await page
          .locator(
            `#${domElementIds.agencyDashboard.registerAgencies.table} table tbody tr .fr-checkbox-group`,
          )
          .nth(index)
          .click();
      }

      await page
        .locator(
          `#${domElementIds.agencyDashboard.registerAgencies.submitButton}`,
        )
        .click();

      await expect(page.locator(".fr-alert--success").first()).toBeVisible();

      await expect(
        page.locator(
          `[id^=${domElementIds.agencyDashboard.agencyTab.cancelRegistrationButton}]`,
        ),
      ).toHaveCount(registeredAgencyCount);
    });

    test("an Ic user should be able to ask to cancel a registration request to an agency", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "agency");

      expect(
        await page
          .locator(
            `[id^="${domElementIds.agencyDashboard.agencyTab.cancelRegistrationButton}"]`,
          )
          .count(),
      ).toBe(registeredAgencyCount);

      await page
        .locator(
          `[id^="${domElementIds.agencyDashboard.agencyTab.cancelRegistrationButton}"]`,
        )
        .first()
        .click();

      await expect(page.locator(".fr-alert--success").first()).toBeVisible();

      expect(
        await page
          .locator(
            `[id^="${domElementIds.agencyDashboard.agencyTab.cancelRegistrationButton}"]`,
          )
          .count(),
      ).toBe(registeredAgencyCount - 1);
    });
  });

  test.describe("Agency admin registration", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test("admin validates user registration to agency", async ({ page }) => {
      await page.goto("/");
      await goToAdminTab(page, "adminAgencies");
      await page
        .locator(
          `#${domElementIds.admin.agencyTab.selectIcUserToReview} option:nth-child(2)`,
        )
        .waitFor({ state: "attached" });

      await page
        .locator(`#${domElementIds.admin.agencyTab.selectIcUserToReview}`)
        .selectOption({
          index: 1,
        });
      const registerButton = await page
        .locator(
          `[id^=${domElementIds.admin.agencyTab.registerIcUserToAgencyButton}]`,
        )
        .first();
      await expect(registerButton).toBeVisible();
      await registerButton.click();
      await expect(
        page.locator(
          `#${domElementIds.admin.agencyTab.userRegistrationToAgencyModal}`,
        ),
      ).toBeVisible();
      await page
        .locator(
          `[for="${domElementIds.admin.agencyTab.editAgencyManageUserCheckbox}-2"]`,
        )
        .click();
      await page
        .locator(
          `#${domElementIds.admin.agencyTab.editAgencyUserRoleSubmitButton}`,
        )
        .click();
      await expect(page.locator(".fr-alert--success").first()).toBeVisible();
      await page.waitForTimeout(testConfig.timeForEventCrawler);
    });
  });

  test.describe("Agency user dashboard access", () => {
    test.use({ storageState: testConfig.agencyAuthFile });
    test("IC user can access to the agency dashboard", async ({ page }) => {
      await page.goto("/");
      await goToDashboard(page, "agency");
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.dashboard.tabContainer}`,
        ),
      ).toBeVisible();
    });

    test("IC user can open the agency registration page from its agencies", async ({
      page,
    }) => {
      await page.goto(frontRoutes.agencyDashboardAgencies().href);

      await page
        .locator(
          `#${domElementIds.agencyDashboard.registerAgencies.newAgencyButton}`,
        )
        .click();

      await page.waitForURL(`**${frontRoutes.agencyUserRegistration().href}**`);
      await expect(
        page.locator(
          `#${domElementIds.agencyDashboard.registerAgencies.search}`,
        ),
      ).toBeVisible();
    });
  });

  test.describe("Manage convention templates", () => {
    let templateId: string;
    test.use({ storageState: testConfig.agencyAuthFile });

    test("IC user can create a new convention template", async ({ page }) => {
      templateId = await createConventionTemplate(page, "agency");
    });

    test("IC user can update a convention template", async ({ page }) => {
      const newConventionTemplateName = "Modèle de convention modifié";
      await page.goto("/");
      await goToDashboard(page, "agency");

      await page
        .locator(
          `#${domElementIds.conventionTemplate.editConventionTemplateButton}-${templateId}`,
        )
        .click();

      const nameInput = page.locator(
        `#${domElementIds.conventionTemplate.form.nameInput}`,
      );
      await expect(nameInput).toHaveValue("Mon premier modèle de convention");
      await nameInput.fill(newConventionTemplateName);
      await expect(nameInput).toHaveValue(newConventionTemplateName);

      await page.click(
        `#${domElementIds.conventionTemplate.form.submitFormButton}`,
      );
      await expect(page.locator(".fr-alert--success")).toBeVisible();

      await goToDashboard(page, "agency");
      await expect(
        page.locator(`#convention-template-${templateId}`),
      ).toContainText(newConventionTemplateName);
    });

    test("IC user can share a convention template as a draft", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "agency");

      await page
        .locator(
          `#${domElementIds.conventionTemplate.shareAsConventionDraft.button}-${templateId}`,
        )
        .click();

      await page.fill(
        `#${domElementIds.conventionTemplate.shareAsConventionDraft.emailInput}`,
        faker.internet.email(),
      );
      await page.click(
        `#${domElementIds.conventionTemplate.shareAsConventionDraft.submitButton}`,
      );
      await expect(page.locator(".fr-alert--success")).toBeVisible();
    });

    test("IC user can delete a convention template", async ({ page }) => {
      await deleteConventionTemplate(page, "agency", templateId);
    });
  });

  test.skip("Initiate convention", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("should initiate from a convention template", async ({ page }) => {
      const templateId = await createConventionTemplate(page, "agency");
      await initiateConvention({
        page,
        dashboardKind: "agency",
        fromConventionTemplate: true,
        templateId,
      });
      await deleteConventionTemplate(page, "agency", templateId);
    });

    test("should initiate from agency informations", async ({ page }) => {
      await initiateConvention({
        page,
        dashboardKind: "agency",
        fromConventionTemplate: false,
      });
    });
  });
});
