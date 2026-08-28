import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { type AgencyId, domElementIds } from "shared";
import { testConfig } from "../../custom.config";
import { goToAdminTab } from "../../utils/admin";
import { fillAndSubmitBasicAgencyForm } from "../../utils/agency";
import {
  createConventionTemplate,
  deleteConventionTemplate,
  goToDashboard,
  initiateConvention,
} from "../../utils/dashboard";
import { e2eSiretEstablishments } from "../../utils/siret";
import { fillAutocomplete, test } from "../../utils/utils";

test.describe.configure({ mode: "serial" });

test.describe("Agency dashboard workflow", () => {
  let agencyId: AgencyId | null = null;
  const agencySiret = e2eSiretEstablishments[1].siret;

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
          `[id^=${domElementIds.myAccount.cancelRegistrationButton}]`,
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
            `[id^="${domElementIds.myAccount.cancelRegistrationButton}"]`,
          )
          .count(),
      ).toBe(registeredAgencyCount);

      await page
        .locator(`[id^="${domElementIds.myAccount.cancelRegistrationButton}"]`)
        .first()
        .click();

      await expect(page.locator(".fr-alert--success").first()).toBeVisible();

      expect(
        await page
          .locator(
            `[id^="${domElementIds.myAccount.cancelRegistrationButton}"]`,
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
  });

  test.describe("Manage convention templates", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("IC user can create a new convention template", async ({ page }) => {
      await createConventionTemplate(page, "agency");
    });

    test("IC user can update a convention template", async ({ page }) => {
      const newConventionTemplateName = "Modèle de convention modifié";
      await page.goto("/");
      await goToDashboard(page, "agency");

      await page
        .locator(
          `[id^="${domElementIds.conventionTemplate.editConventionTemplateButton}-"]`,
        )
        .first()
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
        await page.locator('[id^="convention-template-"]').first(),
      ).toContainText(newConventionTemplateName);
    });

    test("IC user can share a convention template as a draft", async ({
      page,
    }) => {
      await page.goto("/");
      await goToDashboard(page, "agency");

      await page
        .locator(
          `[id^="${domElementIds.conventionTemplate.shareAsConventionDraft.button}-"]`,
        )
        .first()
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
      await deleteConventionTemplate(page, "agency");
    });
  });

  test.skip("Initiate convention", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("should initiate from a convention template", async ({ page }) => {
      await createConventionTemplate(page, "agency");
      await initiateConvention({
        page,
        dashboardKind: "agency",
        fromConventionTemplate: true,
      });
      await deleteConventionTemplate(page, "agency");
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
