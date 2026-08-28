import { faker } from "@faker-js/faker";
import { expect, type Page } from "@playwright/test";
import { addBusinessDays, format } from "date-fns";
import {
  type AgencyId,
  addressRoutes,
  type ConventionId,
  domElementIds,
  executeInSequence,
  frontRoutes,
  SEED_FT_AGENCY_ID,
  technicalRoutes,
} from "shared";
import { getMagicLinkFromEmail, goToAdminTab } from "./admin";
import { getRandomizedData } from "./data";
import { defaultE2eSiret } from "./siret";
import {
  acceptCookiesIfBannerVisible,
  expectElementToBeVisible,
  expectLocatorToBeVisibleAndEnabled,
  fillAutocomplete,
  remoteModeIndexMap,
  validPhonesData,
} from "./utils";

export type ConventionSubmitted = {
  agencyId: AgencyId;
};

const beneficiaryBirthdate = faker.date
  .birthdate({
    min: 1910,
    max: 2005,
  })
  .toISOString()
  .split("T")[0];

const beneficiaryBirthdateDisplayed = format(
  new Date(beneficiaryBirthdate),
  "dd/MM/yyyy",
);

const getCurrentDate = () => format(new Date(), "yyyy-MM-dd");
const getTomorrowDate = () =>
  format(addBusinessDays(new Date(), 1), "yyyy-MM-dd");

const currentDate = getCurrentDate();
const currentDateDisplayed = format(new Date(currentDate), "dd/MM/yyyy");
const tomorrowDate = getTomorrowDate();
export const tomorrowDateDisplayed = format(
  new Date(tomorrowDate),
  "dd/MM/yyyy",
);
const updatedEndDate = format(addBusinessDays(new Date(), 3), "yyyy-MM-dd");
export const updatedEndDateDisplayed = format(
  new Date(updatedEndDate),
  "dd/MM/yyyy",
);

export const fillConventionForm = async (page: Page) => {
  await page.selectOption(
    `#${domElementIds.conventionImmersion.conventionSection.agencyDepartment}`,
    "75",
  );

  await page.selectOption(
    `#${domElementIds.conventionImmersion.conventionSection.agencyId}`,
    SEED_FT_AGENCY_ID,
  );
  await openConventionAccordionSection(page, 1); // Open Beneficiary section
  await page.fill(
    `#${domElementIds.conventionImmersion.beneficiarySection.firstName}`,
    faker.person.firstName(),
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.beneficiarySection.lastName}`,
    faker.person.lastName(),
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.beneficiarySection.email}`,
    "recette+beneficiary@immersion-facile.beta.gouv.fr",
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.beneficiarySection.phone}`,
    validPhonesData.beneficiary,
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.beneficiarySection.birthdate}`,
    beneficiaryBirthdate,
  );
  await openConventionAccordionSection(page, 2); // Open Establishment section

  const siretInput = page.locator(
    `#${domElementIds.conventionImmersion.conventionSection.siret}`,
  );
  await siretInput.clear();
  await siretInput.pressSequentially(defaultE2eSiret);

  const establishmentFirstName = page.locator(
    `#${domElementIds.conventionImmersion.establishmentRepresentativeSection.firstName}`,
  );
  await expect(establishmentFirstName).toBeEnabled({ timeout: 15_000 });
  await establishmentFirstName.fill(faker.person.firstName());
  await page.fill(
    `#${domElementIds.conventionImmersion.establishmentRepresentativeSection.lastName}`,
    faker.person.lastName(),
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.establishmentRepresentativeSection.phone}`,
    validPhonesData.establishmentRepresentative,
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.establishmentRepresentativeSection.email}`,
    "recette+establishment-tutor@immersion-facile.beta.gouv.fr",
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.establishmentTutorSection.job}`,
    faker.person.jobType(),
  );
  await openConventionAccordionSection(page, 3); // Open place / hour section
  await page.fill(
    `#${domElementIds.conventionImmersion.conventionSection.dateStart}`,
    currentDate,
  );
  await page.focus(
    `#${domElementIds.conventionImmersion.conventionSection.dateEnd}`,
  );
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.dateStart}`,
    ),
  ).toHaveValue(currentDate);
  await page.fill(
    `#${domElementIds.conventionImmersion.conventionSection.dateEnd}`,
    tomorrowDate,
  );
  await page.click(
    `#${domElementIds.conventionImmersion.conventionSection.addHoursButton}`,
  );

  await fillAutocomplete({
    page,
    locator: `#${domElementIds.conventionImmersion.conventionSection.immersionAddress}`,
    value: getRandomizedData("addressQueries"),
    endpoint: addressRoutes.lookupStreetAddress.url,
  });

  await page.click(
    `[for='${domElementIds.conventionImmersion.conventionSection.remoteWorkMode}-${remoteModeIndexMap.ON_SITE}']`,
  );

  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.dateEnd}`,
    ),
  ).toHaveValue(tomorrowDate);
  await openConventionAccordionSection(page, 4); // Open immersion details section

  await page.click(
    `[for="${domElementIds.conventionImmersion.conventionSection.individualProtection}-0"]`,
  );
  await page.click(
    `[for="${domElementIds.conventionImmersion.conventionSection.sanitaryPrevention}-0"]`,
  );
  await page.click(
    `[for="${domElementIds.conventionImmersion.conventionSection.immersionObjective}-1"]`,
  );
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.conventionImmersion.conventionSection.immersionAppellation}`,
    value: getRandomizedData("jobs"),
  });
  await page.fill(
    `#${domElementIds.conventionImmersion.conventionSection.immersionActivities}`,
    faker.word.words(8),
  );
};

export const goToFormPageAndFillConventionForm = async (
  page: Page,
): Promise<AgencyId | undefined> => {
  await page.goto(frontRoutes.initiateConvention().href);
  await expect(
    await page.request.get(technicalRoutes.featureFlags.url),
  ).toBeOK();
  const formButton = await page.locator(
    `#${domElementIds.initiateConvention.navCards.candidate}`,
  );
  await formButton.waitFor();
  await formButton.click();
  await page
    .locator(`#${domElementIds.initiateConvention.otherStructureButton}`)
    .click();
  await page.waitForURL(`${frontRoutes.conventionImmersion().href}**`);

  await fillConventionForm(page);

  return "40400c99-9c0b-bbbb-bb6d-6bb9bd300404";
};

export const submitBasicConventionForm = async (
  page: Page,
): Promise<ConventionSubmitted | void> => {
  const agencyId = await goToFormPageAndFillConventionForm(page);
  expect(agencyId).not.toBeFalsy();
  if (!agencyId) return;
  await confirmCreateConventionFormSubmit(page, tomorrowDateDisplayed);

  return {
    agencyId,
  };
};

export const signConvention = async (
  page: Page,
  magicLink: string,
  dateEndDisplayed: string,
) => {
  await page.goto(magicLink);
  await expect(page.locator(".fr-alert--success")).toBeHidden();

  await checkConventionSummary(page, dateEndDisplayed);

  await expectLocatorToBeVisibleAndEnabled(
    await page.locator(
      `#${domElementIds.conventionToSign.openSignModalButton}`,
    ),
  );

  await page.click(`#${domElementIds.conventionToSign.openSignModalButton}`);

  await expectLocatorToBeVisibleAndEnabled(
    await page.locator(`#${domElementIds.conventionToSign.submitButton}`),
  );
  await page.click(`#${domElementIds.conventionToSign.submitButton}`);
  await expect(
    page
      .locator(".fr-alert--success")
      .getByRole("heading", { name: "Vous avez signé cette convention." }),
  ).toBeVisible();
};

export const allOtherSignatoriesSignConvention = async ({
  page,
  expectedConventionEndDate,
}: {
  page: Page;
  expectedConventionEndDate: string;
}) => {
  const signatoriesMagicLinks: string[] = [];
  await page.goto("/");
  await goToAdminTab(page, "adminNotifications");
  const allOtherSignatoriesCount = 3;
  for (let index = 0; index < allOtherSignatoriesCount; index++) {
    const href = await getMagicLinkFromEmail({
      page,
      emailType: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
      elementIndex: index,
      label: "conventionSignShortlink",
    });
    if (href) {
      signatoriesMagicLinks.push(href);
    }
  }

  await executeInSequence(signatoriesMagicLinks, (href) =>
    signConvention(page, href, expectedConventionEndDate),
  );
};

export const submitEditConventionForm = async (
  page: Page,
  conventionSubmitted: ConventionSubmitted | void,
) => {
  const agencyIdSelect = page.locator(
    `#${domElementIds.conventionImmersion.conventionSection.agencyId}`,
  );
  await agencyIdSelect.locator("option").locator("nth=1").waitFor({
    state: "hidden",
  });
  expect(conventionSubmitted).not.toBeUndefined();
  if (conventionSubmitted?.agencyId) {
    await expect(
      page.locator(
        `#${domElementIds.conventionImmersion.conventionSection.agencyId}`,
      ),
    ).toHaveValue(conventionSubmitted.agencyId);
  }
  await openConventionAccordionSection(page, 1);
  await page
    .locator(
      `[for='${domElementIds.conventionImmersion.conventionSection.isMinor}-0']`,
    )
    .click();
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.firstName}`,
    ),
  ).toBeVisible();
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.firstName}`,
    )
    .fill(faker.person.firstName());
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.lastName}`,
    )
    .fill(faker.person.lastName());
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.email}`,
    )
    .fill("recette+beneficiary-rep@immersion-facile.beta.gouv.fr");
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.phone}`,
    )
    .fill(validPhonesData.beneficiaryRepresentative);
  await page
    .locator(
      `[for='${domElementIds.conventionImmersion.conventionSection.isCurrentEmployer}-0']`,
    )
    .click();
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.businessSiret}`,
    ),
  ).toBeVisible();
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.businessSiret}`,
    )
    .fill(faker.string.numeric("XXXXXXXXXXXXXX"));
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.businessName}`,
    )
    .fill(faker.company.name());
  await fillAutocomplete({
    page,
    locator: `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.businessAddress}`,
    value: getRandomizedData("addressQueries"),
  });
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.firstName}`,
    )
    .fill(faker.person.firstName());
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.lastName}`,
    )
    .fill(faker.person.lastName());
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.job}`,
    )
    .fill(faker.person.jobType());
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.phone}`,
    )
    .fill(validPhonesData.beneficiaryCurrentEmployer);
  await page
    .locator(
      `#${domElementIds.conventionImmersion.beneficiaryCurrentEmployerSection.email}`,
    )
    .fill("recette+current-employer@immersion-facile.beta.gouv.fr");

  await openConventionAccordionSection(page, 2);
  await page
    .locator(
      `#${domElementIds.conventionImmersion.establishmentTutorSection.job}`,
    )
    .fill("Edited job");
  await openConventionAccordionSection(page, 3);
  await page
    .locator(`#${domElementIds.conventionImmersion.conventionSection.dateEnd}`)
    .fill(updatedEndDate);

  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.dateEnd}`,
    ),
  ).toHaveValue(updatedEndDate);

  await page
    .locator(".schedule-picker__day-circle")
    .getByRole("button", { disabled: false })
    .all()
    .then((buttons) => buttons[0].click());

  await page
    .locator(
      `#${domElementIds.conventionImmersion.conventionSection.addHoursButton}`,
    )
    .click();
  await page
    .locator(`#${domElementIds.conventionImmersion.submitFormButton}`)
    .click();
  await expect(page.locator(".fr-alert--error")).not.toBeVisible();
  await expectElementToBeVisible(page, ".im-convention-summary__section");
  await expect(
    await page
      .locator(".im-convention-summary__section", {
        has: page.getByText("Signataires de la convention"),
      })
      .getByText("Employeur actuel du bénéficiaire"),
  ).toBeVisible();
  await expect(
    await page
      .locator(".im-convention-summary__section", {
        has: page.getByText("Signataires de la convention"),
      })
      .getByText("Employeur actuel"),
  ).toBeVisible();

  await page.fill(
    `#${domElementIds.conventionImmersion.statusJustificationInput}`,
    "justification de la modification",
  );

  await page.click(
    `#${domElementIds.conventionImmersion.confirmSubmitFormButton}`,
  );

  await expect(page.locator(".fr-alert--error").first()).not.toBeVisible();
};

export const openConventionAccordionSection = async (
  page: Page,
  sectionIndex: number,
) => {
  await page
    .locator(".fr-accordion")
    .nth(sectionIndex)
    .locator(".fr-accordion__btn")
    .click();
};

export const checkConventionSummary = async (
  page: Page,
  dateEndDisplayed: string,
) => {
  await expectElementToBeVisible(page, ".im-convention-summary__section");
  await expect(
    await page
      .locator(".im-convention-summary__section", {
        has: page.getByText("Signataires de la convention"),
      })
      .getByText("Bénéficiaire", { exact: true }),
  ).toBeVisible();
  await expect(
    await page
      .locator(".im-convention-summary__section", {
        has: page.getByText("Signataires de la convention"),
      })
      .getByText("Représentant de l'entreprise"),
  ).toBeVisible();
  await expect(
    await page
      .locator("#im-convention-summary__subsection__value-beneficiaryBirthdate")
      .textContent(),
  ).toContain(beneficiaryBirthdateDisplayed);
  await expect(
    await page
      .locator("#im-convention-summary__subsection__value-dateStart")
      .textContent(),
  ).toContain(currentDateDisplayed);
  await expect(
    await page
      .locator("#im-convention-summary__subsection__value-dateEnd")
      .textContent(),
  ).toContain(dateEndDisplayed);
};

export const confirmCreateConventionFormSubmit = async (
  page: Page,
  dateEndDisplayed: string,
) => {
  await page.click(`#${domElementIds.conventionImmersion.submitFormButton}`);
  await checkConventionSummary(page, dateEndDisplayed);

  await page.click(
    `#${domElementIds.conventionImmersion.confirmSubmitFormButton}`,
  );
  await expectElementToBeVisible(
    page,
    `#${domElementIds.conventionImmersion.conventionConfirmation.copyConventionIdButton}`,
  );
};

export const shareConventionDraftByEmail = async (page: Page) => {
  await page.click(
    `#${domElementIds.conventionImmersion.shareConventionDraft.shareButton}`,
  );
  await page.fill(
    `#${domElementIds.conventionImmersion.shareConventionDraft.shareFormEmailInput}`,
    "test@immersion-facile.beta.gouv.fr",
  );
  await page.click(
    `#${domElementIds.conventionImmersion.shareConventionDraft.shareFormSubmitButton}`,
  );
  await expectElementToBeVisible(page, ".fr-alert--success");
  await page.click(
    `#${domElementIds.conventionImmersion.shareConventionDraft.shareFormCancelButton}`,
  );
};

export const navigateToAgencyDashboardMain = async (page: Page) => {
  await page.click("#fr-header-main-navigation-button-3");
  await page.click(`#${domElementIds.header.navLinks.agency.dashboard}`);
  await expect(
    page.locator(`#${domElementIds.agencyDashboard.dashboard.tabContainer}`),
  ).toBeVisible();
};

export const openManageConventionPageFromDashboard = async (
  page: Page,
  conventionId: ConventionId,
): Promise<Page> => {
  const goToConventionButton = page.locator(
    `#${domElementIds.agencyDashboard.dashboard.goToConventionButton}--${conventionId}`,
  );
  await expect(goToConventionButton).toBeVisible();
  const [manageConventionPage] = await Promise.all([
    page.context().waitForEvent("page"),
    goToConventionButton.click(),
  ]);
  await manageConventionPage.waitForLoadState("domcontentloaded");
  await manageConventionPage.waitForURL(
    `**${frontRoutes.manageConventionConnectedUser({ conventionId }).href}**`,
  );
  await acceptCookiesIfBannerVisible(manageConventionPage);
  return manageConventionPage;
};

export const clickbuttonInSubMenu = async (
  page: Page,
  subMenuButtonId: string,
  buttonId: string,
) => {
  await acceptCookiesIfBannerVisible(page);

  const subMenuButton = page.locator(`#${subMenuButtonId}`);
  await expect(subMenuButton).toBeVisible();
  const subMenu = page.locator(`#${subMenuButtonId}-submenu`);
  const subMenuContainer = subMenu.locator("..");
  await subMenuButton.click();
  await expect(subMenuContainer).toHaveClass(
    /im-button-with-sub-menu--is-opened/,
  );

  const button = page.locator(`#${buttonId}`);
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await button.click();
};

export const fillJustificationTextarea = async (
  page: Page,
  formId: string,
  value: string,
) => {
  await page
    .locator(`form#${formId} textarea[name="statusJustification"]`)
    .fill(value);
};
