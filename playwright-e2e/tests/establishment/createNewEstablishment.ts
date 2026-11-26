import { expect, type Page } from "@playwright/test";
import {
  type AdminFormEstablishmentUserRight,
  addressRoutes,
  domElementIds,
  type FormEstablishmentDto,
  formCompletionRoutes,
  type RemoteWorkMode,
} from "shared";
import { testConfig } from "../../custom.config";
import {
  expectNoErrorVisible,
  fillAutocomplete,
  type PlaywrightTestCallback,
  remoteModeIndexMap,
} from "../../utils/utils";
import {
  goToNextStep,
  type MakeFormEstablishmentFromRetryNumber,
} from "./establishmentForm.utils";

export const createEstablishmentForm =
  (
    makeEstablishment: MakeFormEstablishmentFromRetryNumber,
  ): PlaywrightTestCallback =>
  async ({ page }, { retry }) => {
    const establishment = makeEstablishment(retry);
    const adminRight = establishment.userRights.find(
      (right) => right.role === "establishment-admin",
    );
    if (!adminRight)
      throw new Error("Missing admin right for createNewEstablishment");

    await goToCreateEstablishmentForm(page);

    await step1(page, adminRight, establishment);

    await step2(page);

    await step3(page);

    await step4(page, establishment);

    await page.waitForTimeout(testConfig.timeForEventCrawler);
  };

export const goToCreateEstablishmentForm = async (page: Page) => {
  await page.goto("/");
  await page.click(`#${domElementIds.home.heroHeader.establishment}`);
  await page.click(
    `#${domElementIds.homeEstablishments.heroHeader.addEstablishmentForm}`,
  );
};

const step1 = async (
  page: Page,
  adminRight: AdminFormEstablishmentUserRight,
  establishment: FormEstablishmentDto,
) => {
  const siretInput = await page.locator(
    `#${domElementIds.formEstablishment.create.siret}`,
  );

  await siretInput.fill(establishment.siret);

  await expect(
    page.locator(
      `#${domElementIds.formEstablishment.create.businessContact.firstName}`,
    ),
  ).toHaveValue("Jean");
  await expect(
    page.locator(
      `#${domElementIds.formEstablishment.create.businessContact.lastName}`,
    ),
  ).toHaveValue("Immersion");
  await expect(
    page.locator(
      `#${domElementIds.formEstablishment.create.businessContact.email}`,
    ),
  ).toHaveValue(adminRight.email);

  await page.fill(
    `#${domElementIds.formEstablishment.create.businessContact.job}`,
    adminRight.job,
  );
  await page.fill(
    `#${domElementIds.formEstablishment.create.businessContact.phone}`,
    adminRight.phone,
  );

  await goToNextStep(page, 1, "create");
};

const step2 = async (page: Page) => {
  await expectNoErrorVisible(page);

  const availableRadioLocator = page.locator(
    `[for='${domElementIds.formEstablishment.create.availabilityButton}-1']`,
  );
  const unavailableRadioLocator = page.locator(
    `[for='${domElementIds.formEstablishment.create.availabilityButton}-0']`,
  );
  await expect(availableRadioLocator).not.toBeChecked();
  await expect(unavailableRadioLocator).not.toBeChecked();

  await availableRadioLocator.click();

  await addLocation(page);

  await page
    .locator(`[for='${domElementIds.formEstablishment.create.contactMode}-0']`)
    .click();

  await page
    .locator(
      `[for='${domElementIds.formEstablishment.create.businessContact.isMainContactByPhone}-0']`,
    )
    .click();

  await goToNextStep(page, 2, "create");
};

const step3 = async (page: Page) => {
  await expectNoErrorVisible(page);

  await fillFirstOffer(page, "boulang", "HYBRID");

  await goToNextStep(page, 3, "create");
};

const step4 = async (page: Page, establishment: FormEstablishmentDto) => {
  const summarySiretValue = await page.locator(
    `#${domElementIds.formEstablishment.create.summarySiretValue}`,
  );
  await expect(summarySiretValue).toHaveText(establishment.siret);

  const summaryAdminName = await page.locator(
    `#${domElementIds.formEstablishment.create.summaryAdminName}`,
  );
  await expect(summaryAdminName).toContainText("Jean IMMERSION");

  const summaryBusinessAddresses = await page.locator(
    `#${domElementIds.formEstablishment.create.summaryBusinessAddresses} li`,
  );
  await expect(summaryBusinessAddresses).toHaveCount(2);

  const summaryAppellations = await page.locator(
    `#${domElementIds.formEstablishment.create.summaryAppellations} li`,
  );
  await expect(summaryAppellations).toHaveCount(1);

  await page.click(
    `#${domElementIds.formEstablishment.create.submitFormButton}`,
  );
  await expect(
    page.locator(
      `#${domElementIds.formEstablishment.create.navigateToEstablishmentDashboard}`,
    ),
  ).toBeVisible({
    timeout: 20_000,
  });
};

const fillFirstOffer = async (
  page: Page,
  appelationValue: string,
  remoteMode: RemoteWorkMode,
): Promise<void> => {
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.formEstablishment.create.appellations}`,
    value: appelationValue,
    endpoint: formCompletionRoutes.appellation.url,
  });

  await page.click(
    `[for='${domElementIds.formEstablishment.create.remoteWorkMode}-${remoteModeIndexMap[remoteMode]}']`,
  );
};

const addLocation = async (page: Page) => {
  await page.click(
    `#${domElementIds.formEstablishment.create.businessAddresses}-add-option-button`,
  );

  await fillAutocomplete({
    page,
    locator: `#${domElementIds.formEstablishment.create.businessAddresses}-1`,
    value: "28 rue des mimosas",
    endpoint: addressRoutes.lookupStreetAddress.url,
  });
};
