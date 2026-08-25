import { faker } from "@faker-js/faker";
import { expect, type Page } from "@playwright/test";
import {
  type AgencyId,
  addressRoutes,
  domElementIds,
  frontRoutes,
} from "shared";
import { goToAdminTab } from "./admin";
import { fillAutocomplete } from "./utils";

export const fillAndSubmitBasicAgencyForm = async (
  page: Page,
  override?: {
    siret?: string;
    customizedName?: string;
    rawAddress?: string;
    validatorEmail?: string;
    agencyContactEmail?: string;
  },
): Promise<AgencyId | null> => {
  await goToAddAgencyFormThroughAgencyLandingPage(page);
  await page
    .locator(`[for="${domElementIds.addAgency.agencyRefersToInput}-0"]`)
    .click();
  await page
    .locator(`#${domElementIds.addAgency.kindSelect}`)
    .selectOption("cap-emploi");

  await page
    .locator(`#${domElementIds.addAgency.agencySiretInput}`)
    .fill(override?.siret ?? "751 984 972 00016");

  await expect(
    page.locator(
      `#${domElementIds.addAgency.addressAutocomplete}-wrapper .im-select__single-value`,
    ),
  ).toHaveText(/\S/, { timeout: 15_000 });

  await expect(
    page.locator(`#${domElementIds.addAgency.nameInput}`),
  ).not.toHaveValue("", { timeout: 15_000 });

  await page
    .locator(`#${domElementIds.addAgency.nameInput}`)
    .fill(override?.customizedName ?? "Cap emploi de Bayonne");
  await page
    .locator(
      `#${domElementIds.addAgency.addressAutocomplete}-wrapper .im-select__clear-indicator`,
    )
    .click();
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.addAgency.addressAutocomplete}`,
    value: override?.rawAddress ? "17 rue lamartine" : "18 rue des tonneliers",
    endpoint: addressRoutes.lookupStreetAddress.url,
  });

  await expect(
    page.locator(`#${domElementIds.addAgency.nameInput}`),
  ).toHaveValue(override?.customizedName ?? "Cap emploi de Bayonne");

  await page
    .locator(`#${domElementIds.addAgency.validatorEmailsInput}`)
    .click();
  await page
    .locator(`#${domElementIds.addAgency.validatorEmailsInput}`)
    .fill(override?.validatorEmail ?? "valideur@cap.com");

  await page
    .locator(`#${domElementIds.addAgency.agencyContactEmailInput}`)
    .click();
  await page
    .locator(`#${domElementIds.addAgency.agencyContactEmailInput}`)
    .fill(override?.agencyContactEmail ?? "valideur@cap.com");

  await page
    .locator(`#${domElementIds.addAgency.phoneNumberInput}`)
    .fill("0600000000");
  await page.locator(`#${domElementIds.addAgency.signatureInput}`).click();
  await page
    .locator(`#${domElementIds.addAgency.signatureInput}`)
    .fill("Mon équipe de ouf !");
  const agencyId = await page
    .locator(`#${domElementIds.addAgency.id}`)
    .getAttribute("value");
  await page.locator(`#${domElementIds.addAgency.submitButton}`).click();
  await expect(
    page.locator(".fr-alert--success, .fr-alert--error"),
  ).toBeVisible({ timeout: 30_000 });
  return agencyId;
};

export const rejectAgencyInAdmin = async (page: Page, agencyName: string) => {
  await page.goto("/");
  await goToAdminTab(page, "adminAgencies");
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.admin.agencyTab.editAgencyAutocompleteInput}`,
    value: agencyName,
  });

  const statusSelector = page.locator(
    `#${domElementIds.admin.agencyTab.editAgencyFormStatusSelector}`,
  );
  await expect(statusSelector).toBeVisible();
  await statusSelector.selectOption("rejected");

  await page
    .locator(
      `#${domElementIds.admin.agencyTab.editAgencyFormStatusJustificationInput}`,
    )
    .fill("This is a justification");

  await page
    .locator(`#${domElementIds.admin.agencyTab.editAgencyFormEditSubmitButton}`)
    .click();

  await expect(page.locator(".fr-alert--success").first()).toBeVisible();
};

export const addUserToAgency = async (page: Page, agencyName: string) => {
  await page.goto("/");
  await goToAdminTab(page, "adminAgencies");
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.admin.agencyTab.editAgencyAutocompleteInput}`,
    value: agencyName,
  });
  await expect(
    page.locator(`#${domElementIds.admin.agencyTab.agencyUsersTable}`),
  ).toBeVisible();
  const addUserButton = page.locator(
    `#${domElementIds.admin.agencyTab.openManageUserModalButton}`,
  );
  await expect(addUserButton).toBeVisible();
  await addUserButton.click();
  await expect(
    page.locator(`#${domElementIds.admin.agencyTab.editAgencyManageUserModal}`),
  ).toBeVisible();
  await page
    .locator(`#${domElementIds.admin.agencyTab.editAgencyUserEmail}`)
    .fill(faker.internet.email());
  await page
    .locator(
      `[for="${domElementIds.admin.agencyTab.editAgencyManageUserCheckbox}-1"]`,
    )
    .click();
  await page
    .locator(
      `#${domElementIds.admin.agencyTab.editAgencyUserIsNotifiedByEmail}`,
    )
    .click();
  await page
    .locator(`#${domElementIds.admin.agencyTab.editAgencyUserRoleSubmitButton}`)
    .click();
  await expect(page.locator(".fr-alert--success").first()).toBeVisible();
};

export const goToAddAgencyFormThroughAgencyLandingPage = async (page: Page) => {
  await page.goto(frontRoutes.addAgency().href);
};
