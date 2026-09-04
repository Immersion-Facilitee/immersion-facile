import { expect, type Page } from "@playwright/test";
import {
  addressRoutes,
  domElementIds,
  type FormEstablishmentDto,
  frontRoutes,
} from "shared";
import {
  goToDashboard,
  goToEstablishmentDashboardTab,
} from "../../utils/dashboard";
import {
  fillAutocomplete,
  type PlaywrightTestCallback,
  remoteModeIndexMap,
} from "../../utils/utils";
import type { MakeFormEstablishmentFromRetryNumber } from "./establishmentForm.utils";
import { goToManageEtablishmentBySiretInAdmin } from "./establishmentNavigation.utils";

export const updateEstablishmentThroughEstablishmentDashboard =
  (
    makeUpdatedFormEstablishment: MakeFormEstablishmentFromRetryNumber,
  ): PlaywrightTestCallback =>
  async ({ page }, { retry }) => {
    const updatedFormEstablishment = makeUpdatedFormEstablishment(retry);
    await page.goto("/");
    await goToDashboard(page, "establishment");
    await expect(page.locator(".fr-tabs__list")).toBeVisible();

    await goToEstablishmentDashboardTab(page, "fiche-entreprise");

    const establishmentDashboardUrl =
      frontRoutes.establishmentDashboardFormEstablishment({
        siret: updatedFormEstablishment.siret,
      }).href;
    if (!page.url().includes(establishmentDashboardUrl)) {
      await page
        .locator(
          `#${domElementIds.establishmentDashboard.manageEstablishments.selectEstablishmentInput}`,
        )
        .selectOption(updatedFormEstablishment.siret);
    }

    await page.waitForURL(establishmentDashboardUrl);

    await editEstablishmentInEstablishmentDashboard(
      page,
      updatedFormEstablishment,
    );
  };

export const updateEstablishmentAvailabilityThroughBackOfficeAdmin =
  (
    makeUpdatedEstablishment: MakeFormEstablishmentFromRetryNumber,
  ): PlaywrightTestCallback =>
  async ({ page }, { retry }) => {
    const updatedEstablishment = makeUpdatedEstablishment(retry);
    await goToManageEtablishmentBySiretInAdmin(
      page,
      updatedEstablishment.siret,
    );

    await page
      .locator(`#${domElementIds.formEstablishment.admin.availabilityButton}`)
      .getByText("Oui")
      .click();
    await page.click(
      `#${domElementIds.formEstablishment.admin.submitFormButton}`,
    );
    await expect(page.locator(".fr-alert--success")).toBeVisible();
  };

const editEstablishmentInEstablishmentDashboard = async (
  page: Page,
  updatedEstablishment: FormEstablishmentDto,
): Promise<void> => {
  const userRights = updatedEstablishment.userRights;
  if (!userRights)
    throw new Error("Missing user rights for updatedEstablishmentInfos");
  const adminEmail = await page
    .locator("#establishment-users-table tr:first-of-type td:first-of-type")
    .textContent();
  await expect(adminEmail).toContain(userRights[0].email);
  await step1(page, updatedEstablishment);
  await step2(page, updatedEstablishment);
  await step3(page, updatedEstablishment);
  await step4(page, updatedEstablishment);
};

const step1 = async (
  page: Page,
  updatedEstablishment: FormEstablishmentDto,
) => {
  if (!updatedEstablishment.businessNameCustomized)
    throw new Error(
      "Missing business name customized for updatedEstablishmentInfos",
    );

  if (!updatedEstablishment.additionalInformation)
    throw new Error(
      "Missing additional information for updatedEstablishmentInfos",
    );

  if (!updatedEstablishment.website)
    throw new Error("Missing website for updatedEstablishmentInfos");

  await expect(
    page.locator(`#${domElementIds.formEstablishment.edit.siret} input`),
  ).toBeDisabled();
  await expect(
    page.locator(`#${domElementIds.formEstablishment.edit.siret} input`),
  ).toHaveValue(updatedEstablishment.siret);

  await page.fill(
    `#${domElementIds.formEstablishment.edit.businessNameCustomized}`,
    updatedEstablishment.businessNameCustomized,
  );

  await page.fill(
    `#${domElementIds.formEstablishment.edit.additionalInformation}`,
    updatedEstablishment.additionalInformation,
  );

  await page.fill(
    `#${domElementIds.formEstablishment.edit.website}`,
    updatedEstablishment.website,
  );
};

const step2 = async (
  page: Page,
  updatedEstablishment: FormEstablishmentDto,
) => {
  const businessAddress = updatedEstablishment.businessAddresses.at(0);

  if (!businessAddress)
    throw new Error(
      "Missing first business address for updatedEstablishmentInfos",
    );

  await page.click(
    `#${domElementIds.formEstablishment.edit.businessAddresses}-delete-option-button-0`,
  );
  await page.click(
    `#${domElementIds.formEstablishment.edit.businessAddresses}-delete-option-button-0`,
  ); // twice, to remove the second address

  await page.click(
    `#${domElementIds.formEstablishment.edit.deleteOfferButton}-0`,
  );

  await page.click(
    `#${domElementIds.formEstablishment.edit.editOfferButton}-0`,
  );

  await page.click(
    `[for='${domElementIds.formEstablishment.edit.remoteWorkMode}-${remoteModeIndexMap.ON_SITE}']`,
  );

  await page.click(
    `#${domElementIds.formEstablishment.offerModalSubmitButton}`,
  );

  await fillAutocomplete({
    page,
    locator: `#${domElementIds.formEstablishment.edit.businessAddresses}-0`,
    value: businessAddress.rawAddress,
    endpoint: addressRoutes.lookupStreetAddress.url,
  });
};

const step3 = async (
  page: Page,
  updatedEstablishment: FormEstablishmentDto,
): Promise<void> => {
  if (!updatedEstablishment.nextAvailabilityDate)
    throw new Error(
      "Missing next availability date for updatedEstablishmentInfos",
    );

  const unavailableRadioLocator = page.locator(
    `[for="${domElementIds.formEstablishment.edit.availabilityButton}-0"]`,
  );
  await unavailableRadioLocator.click();

  await page
    .locator(
      `#${domElementIds.formEstablishment.edit.nextAvailabilityDateInput}`,
    )
    .fill(updatedEstablishment.nextAvailabilityDate.split("T")[0]);

  await page.fill(
    `#${domElementIds.formEstablishment.edit.maxContactsPerMonth}`,
    updatedEstablishment.maxContactsPerMonth.toString(),
  );

  await page
    .locator(`[for="${domElementIds.formEstablishment.edit.searchableBy}-1"]`)
    .click();
  await page
    .locator(`[for='${domElementIds.formEstablishment.edit.contactMode}-1']`)
    .click();

  await page.click(
    `[for=${domElementIds.formEstablishment.edit.isEngagedEnterprise}-${
      updatedEstablishment.isEngagedEnterprise ? "1" : "0"
    }]`,
  );

  await page.click(
    `[for=${domElementIds.formEstablishment.edit.fitForDisabledWorkers}-${
      updatedEstablishment.fitForDisabledWorkers ? "1" : "0"
    }]`,
  );
};

const step4 = async (
  page: Page,
  updatedEstablishment: FormEstablishmentDto,
) => {
  await page.click(`#${domElementIds.formEstablishment.edit.submitFormButton}`);
  await expect(page.url()).toContain(`siret=${updatedEstablishment.siret}`);
  await expect(page.locator(".fr-alert--success")).toBeVisible();
};
