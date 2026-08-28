import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  type BeneficiaryDashboardTab,
  beneficiaryDashboardTabsList,
  domElementIds,
  type EstablishmentDashboardTab,
  frontRoutes,
} from "shared";
import { getTabIndexByTabName } from "./admin";
import { fillConventionForm } from "./convention";

const establishmentDashboardTabUrls: Record<EstablishmentDashboardTab, string> =
  {
    conventions: frontRoutes.establishmentDashboardConventions().href,
    discussions: frontRoutes.establishmentDashboardDiscussions().href,
    "fiche-entreprise": frontRoutes.establishmentDashboardFormEstablishment({})
      .href,
  };

export const goToEstablishmentDashboardTab = async (
  page: Page,
  tab: EstablishmentDashboardTab,
) => {
  const tabUrl = establishmentDashboardTabUrls[tab];
  await page.goto(tabUrl);
  await page.waitForURL(tabUrl);
};

export const goToBeneficiaryDashboardTab = async (
  page: Page,
  tab: BeneficiaryDashboardTab,
) => {
  await page.waitForSelector(".fr-tabs__list li");
  const tabLocator = await page
    .locator(".fr-tabs__list li")
    .nth(getTabIndexByTabName(beneficiaryDashboardTabsList, tab))
    .locator(".fr-tabs__tab");
  await expect(tabLocator).toBeVisible();
  await tabLocator.click();
  expect(await page.url()).toContain(
    tab === "conventions"
      ? frontRoutes.beneficiaryDashboardConventions().href
      : frontRoutes.beneficiaryDashboardDiscussions().href,
  );
};

type UserKind = "agency" | "establishment" | "candidate";

export const goToDashboard = async (page: Page, userKind: UserKind) => {
  const selectorsByUserKind: Record<UserKind, string> = {
    candidate: "#fr-header-main-navigation-button-1",
    establishment: "#fr-header-main-navigation-button-2",
    agency: "#fr-header-main-navigation-button-3",
  };

  await page.click(selectorsByUserKind[userKind]);
  const submenuItemSelector = `#${domElementIds.header.navLinks[userKind].dashboard}`;
  await page.click(submenuItemSelector);
};

export const createConventionTemplate = async (
  page: Page,
  dashboardKind: "agency" | "establishment",
) => {
  await page.goto("/");
  await goToDashboard(page, dashboardKind);

  await page.click(
    `#${domElementIds.conventionTemplate.createConventionTemplateButton}`,
  );
  await page.waitForURL(
    `**${frontRoutes.conventionTemplate({ fromRoute: dashboardKind === "agency" ? "agencyDashboard" : "establishmentDashboard" }).href}**`,
  );

  const templateName = "Mon premier modèle de convention";
  await page.fill(
    `#${domElementIds.conventionTemplate.form.nameInput}`,
    templateName,
  );
  await fillConventionForm(page);

  await page.click(
    `#${domElementIds.conventionTemplate.form.submitFormButton}`,
  );
  await expect(page.locator(".fr-alert--success")).toBeVisible();
};

export const deleteConventionTemplate = async (
  page: Page,
  dashboardKind: "agency" | "establishment",
) => {
  await page.goto("/");
  await goToDashboard(page, dashboardKind);

  await page
    .locator(
      `[id^="${domElementIds.conventionTemplate.deleteConventionTemplateButton}-"]`,
    )
    .first()
    .click();
  await page.click(
    `#${domElementIds.conventionTemplate.deleteConventionTemplate.confirmButton}`,
  );
  await expect(page.locator(".fr-alert--success")).toBeVisible();
};

export const initiateConvention = async ({
  page,
  dashboardKind,
  fromConventionTemplate,
}: {
  page: Page;
  dashboardKind: "agency" | "establishment";
  fromConventionTemplate: boolean;
}): Promise<void> => {
  if (fromConventionTemplate)
    return initiateConventionFromConventionTemplate({ page, dashboardKind });

  dashboardKind === "establishment"
    ? await initiateConventionFromEstablishmentInformations({ page })
    : await initiateConventionFromAgencyInformations({ page });
};

const initiateConventionFromConventionTemplate = async ({
  page,
  dashboardKind,
}: {
  page: Page;
  dashboardKind: "agency" | "establishment";
}) => {
  const domIds =
    dashboardKind === "agency"
      ? domElementIds.agencyDashboard
      : domElementIds.establishmentDashboard;
  await page.goto("/");
  await goToDashboard(page, dashboardKind);
  await page.click(`#${domIds.initiateConvention.button}`);
  await expect(
    page.locator(`#${domIds.initiateConvention.modal}`),
  ).toBeVisible();

  const templateRadioButtonLocator = page.locator(
    `[for='${domIds.initiateConvention.sourceRadioButtons}-1']`,
  );

  await templateRadioButtonLocator.click();

  const firstConventionTemplateLocator = page.locator(
    `[for='${domIds.initiateConvention.templateRadioButtons}-0']`,
  );

  await firstConventionTemplateLocator.click();

  await page.click(`#${domIds.initiateConvention.modalButton}`);
  await expect(
    page.locator(`#${domElementIds.conventionImmersion.submitFormButton}`),
  ).toBeVisible();
  await page
    .locator(`#${domElementIds.conventionImmersion.submitFormButton}`)
    .click();
  await page.locator(".im-convention-summary__section").first().isVisible();
};

const initiateConventionFromEstablishmentInformations = async ({
  page,
}: {
  page: Page;
}) => {
  await page.goto("/");
  await goToDashboard(page, "establishment");
  await page.click(
    `#${domElementIds.establishmentDashboard.initiateConvention.button}`,
  );

  const establishmentSelectLocator = page.locator(
    `#${domElementIds.establishmentDashboard.initiateConvention.establishmentSelect}`,
  );
  if (!(await establishmentSelectLocator.isDisabled())) {
    await establishmentSelectLocator.selectOption({
      label: "France Merguez Distribution",
    });
  }

  const appellationSelectLocator = page.locator(
    `#${domElementIds.establishmentDashboard.initiateConvention.appellationSelect}`,
  );
  await appellationSelectLocator.selectOption({
    label: "Boucher-charcutier / Bouchère-charcutière",
  });
  const selectedAppellation =
    (
      await appellationSelectLocator.locator("option:checked").textContent()
    )?.trim() ?? "";

  const addressSelectLocator = page.locator(
    `#${domElementIds.establishmentDashboard.initiateConvention.addressSelect}`,
  );
  await expect(addressSelectLocator).toBeVisible();

  const addressOptionCount = await addressSelectLocator
    .locator("option")
    .count();
  if (addressOptionCount > 1)
    await addressSelectLocator.selectOption({ index: 1 });

  const selectedAddress = await addressSelectLocator.inputValue();

  await page.click(
    `#${domElementIds.establishmentDashboard.initiateConvention.modalButton}`,
  );

  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.immersionAddress}`,
    ),
  ).toHaveValue(selectedAddress);
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.immersionAppellation}-wrapper .im-select__single-value`,
    ),
  ).toHaveText(selectedAppellation);
};

const initiateConventionFromAgencyInformations = async ({
  page,
}: {
  page: Page;
}) => {
  await page.goto("/");
  await goToDashboard(page, "agency");
  await page.click(
    `#${domElementIds.agencyDashboard.initiateConvention.button}`,
  );

  const hasConventionTemplates =
    (await page.locator('[id^="convention-template-"]').count()) > 0;

  if (hasConventionTemplates) {
    await page.click(
      `#${domElementIds.agencyDashboard.initiateConvention.modalButton}`,
    );
  }

  await expect(
    page.locator(`#${domElementIds.conventionImmersion.submitFormButton}`),
  ).toBeVisible();
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.agencyReferentFirstName}`,
    ),
  ).toHaveValue("Jean");
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.agencyReferentLastName}`,
    ),
  ).toHaveValue("Immersion");
};
