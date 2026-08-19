import test, { expect, type Page } from "@playwright/test";
import {
  domElementIds,
  frontRoutes,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_2_ID,
  SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_3_ID,
  SEED_AGENCY_WITH_REFERS_TO_ID,
  SEED_FT_AGENCY_ID,
  SEED_IN_REVIEW_CONVENTION_ID,
  SEED_IN_REVIEW_CONVENTION_WITH_DOUBLE_VALIDATION_ID,
  SEED_PARTIALLY_SIGNED_CONVENTION_ID,
  SEED_READY_TO_SIGN_CONVENTION_1_ID,
  SEED_READY_TO_SIGN_CONVENTION_2_ID,
} from "shared";
import { testConfig } from "../../custom.config";
import {
  clickbuttonInSubMenu,
  fillJustificationTextarea,
  navigateToAgencyDashboardMain,
  openManageConventionPageFromDashboard,
} from "../../utils/convention";
import {
  acceptCookiesIfBannerVisible,
  remoteModeIndexMap,
} from "../../utils/utils";

test.describe.configure({ mode: "serial" });

test.describe("Convention manage actions from prescriber dashboard", () => {
  let agencyDashboardPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: testConfig.adminAuthFile,
    });
    agencyDashboardPage = await context.newPage();
    await agencyDashboardPage.goto("/");
    await acceptCookiesIfBannerVisible(agencyDashboardPage);
  });

  test.afterAll(async () => {
    await agencyDashboardPage?.context().close();
  });

  test("ACCEPT_COUNSELLOR: marks an in-review convention as eligible", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const manageConventionPage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_IN_REVIEW_CONVENTION_WITH_DOUBLE_VALIDATION_ID,
    );
    await manageConventionPage
      .locator(
        `#${domElementIds.manageConvention.conventionValidationValidateButton}`,
      )
      .click();
    await expect(
      manageConventionPage.locator(
        `#${domElementIds.manageConvention.counsellorModal}`,
      ),
    ).toBeVisible();
    await expect(
      manageConventionPage.locator(
        `#${domElementIds.manageConvention.validatorModalFirstNameInput}`,
      ),
    ).toHaveValue("Jean");
    await expect(
      manageConventionPage.locator(
        `#${domElementIds.manageConvention.validatorModalLastNameInput}`,
      ),
    ).toHaveValue("Immersion");
    await manageConventionPage
      .locator(`#${domElementIds.manageConvention.counsellorModalSubmitButton}`)
      .click();
    await expect(
      manageConventionPage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await manageConventionPage.close();
  });

  test("RENEW: requests a convention renewal", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_1_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.otherActionsButton,
      domElementIds.manageConvention.openRenewModalButton,
    );
    await expect(
      managePage.locator(`#${domElementIds.manageConvention.renewModal}`),
    ).toBeVisible();
    await managePage
      .locator(
        `form#${domElementIds.manageConvention.renewModalForm} textarea[name="renewed.justification"]`,
      )
      .fill("Renouvellement demandé par le validateur");
    await managePage
      .locator(`#${domElementIds.manageConvention.submitRenewModalButton}`)
      .click();
    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });

  test("DUPLICATE_CONVENTION: redirects to a pre-filled convention form", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_3_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.otherActionsButton,
      domElementIds.manageConvention.duplicateConventionButton,
    );
    await managePage.waitForURL(
      `**${frontRoutes.conventionImmersion().href}**`,
      {
        timeout: 30_000,
      },
    );
    const {
      conventionSection,
      beneficiarySection,
      establishmentTutorSection,
      establishmentRepresentativeSection,
    } = domElementIds.conventionImmersion;

    await expect(
      managePage.locator(`#${conventionSection.agencyDepartment}`),
    ).toHaveValue("75");
    await expect(
      managePage.locator(`#${conventionSection.agencyKind}`),
    ).toHaveValue("france-travail");
    await expect(
      managePage.locator(`#${conventionSection.agencyId}`),
    ).toHaveValue(SEED_FT_AGENCY_ID);
    await expect(managePage.locator(`#${conventionSection.siret}`)).toHaveValue(
      "34493368400021",
    );
    await expect(
      managePage.locator(`#${conventionSection.businessName}`),
    ).toHaveValue("FRANCE MERGUEZ DISTRIBUTION");
    await expect(
      managePage.locator(`#${conventionSection.businessAdvantages}`),
    ).toHaveValue("Prise en charge du panier repas");
    await expect(
      managePage.locator(`#${conventionSection.immersionObjective}-0`),
    ).toBeChecked();
    await expect(
      managePage.locator(
        `#${conventionSection.immersionAppellation}-wrapper .im-select__single-value`,
      ),
    ).toHaveText("Pilote de machines d'abattage");
    await expect(
      managePage.locator(
        `#${conventionSection.remoteWorkMode}-${remoteModeIndexMap.ON_SITE}`,
      ),
    ).toBeChecked();
    await expect(
      managePage.locator(`#${conventionSection.immersionAddress}`),
    ).toHaveValue("169 boulevard de la villette, 75010 Paris");
    await expect(
      managePage.locator(`#${conventionSection.individualProtection}-0`),
    ).toBeChecked();
    await expect(
      managePage.locator(
        `#${conventionSection.individualProtectionDescription}`,
      ),
    ).toHaveValue("casque et lunnettes");
    await expect(
      managePage.locator(`#${conventionSection.sanitaryPrevention}-0`),
    ).toBeChecked();
    await expect(
      managePage.locator(`#${conventionSection.sanitaryPreventionDescription}`),
    ).toHaveValue("fourniture de gel");
    await expect(
      managePage.locator(`#${conventionSection.immersionActivities}`),
    ).toHaveValue("Piloter un automobile");
    await expect(
      managePage.locator(`#${conventionSection.immersionSkills}`),
    ).toHaveValue("Utilisation des pneus optimale, gestion de carburant");

    await expect(
      managePage.locator(`#${beneficiarySection.firstName}`),
    ).toHaveValue("Esteban");
    await expect(
      managePage.locator(`#${beneficiarySection.lastName}`),
    ).toHaveValue("Ocon");
    await expect(
      managePage.locator(`#${beneficiarySection.email}`),
    ).toHaveValue("beneficiary@email.fr");
    await expect(
      managePage.locator(`#${beneficiarySection.phone}`),
    ).toHaveValue("+33123456780");
    await expect(
      managePage.locator(`#${beneficiarySection.birthdate}`),
    ).toHaveValue("2002-10-05");
    await expect(
      managePage.locator(`#${beneficiarySection.emergencyContact}`),
    ).toHaveValue("Clariss Ocon");
    await expect(
      managePage.locator(`#${beneficiarySection.emergencyContactPhone}`),
    ).toHaveValue("+33663567896");
    await expect(
      managePage.locator(`#${beneficiarySection.emergencyContactEmail}`),
    ).toHaveValue("clariss.ocon@emergencycontact.com");
    await expect(
      managePage.locator(`#${conventionSection.isMinor}-1`),
    ).toBeChecked();
    await expect(
      managePage.locator(`#${conventionSection.isCurrentEmployer}-1`),
    ).toBeChecked();

    await expect(
      managePage.locator(
        `#${conventionSection.isEstablishmentTutorIsEstablishmentRepresentative}-1`,
      ),
    ).toBeChecked();
    await expect(
      managePage.locator(`#${establishmentTutorSection.firstName}`),
    ).toHaveValue("Alain");
    await expect(
      managePage.locator(`#${establishmentTutorSection.lastName}`),
    ).toHaveValue("Prost");
    await expect(
      managePage.locator(`#${establishmentTutorSection.email}`),
    ).toHaveValue("establishment@example.com");
    await expect(
      managePage.locator(`#${establishmentTutorSection.phone}`),
    ).toHaveValue("+33601010101");
    await expect(
      managePage.locator(`#${establishmentTutorSection.job}`),
    ).toHaveValue("Big Boss");

    await expect(
      managePage.locator(`#${establishmentRepresentativeSection.firstName}`),
    ).toHaveValue("Billy");
    await expect(
      managePage.locator(`#${establishmentRepresentativeSection.lastName}`),
    ).toHaveValue("Idol");
    await expect(
      managePage.locator(`#${establishmentRepresentativeSection.email}`),
    ).toHaveValue("establishment@example.com");
    await expect(
      managePage.locator(`#${establishmentRepresentativeSection.phone}`),
    ).toHaveValue("+33602010203");

    await managePage.close();
  });

  test("TRANSFER: transfers the convention to another agency", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_READY_TO_SIGN_CONVENTION_1_ID,
    );

    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.editActionsButton,
      domElementIds.manageConvention.transferToAgencyButton,
    );
    await expect(
      managePage.locator(
        `#${domElementIds.manageConvention.transferConventionModal}`,
      ),
    ).toBeVisible();
    await managePage.selectOption("#agencyDepartment", "75");
    const agencyKindSelect = managePage.locator("#agencyKind");
    await expect(agencyKindSelect).toBeVisible();
    await agencyKindSelect.selectOption("autre");

    const agencySelect = managePage.locator("#agencyId");
    await expect(agencySelect).toBeEnabled({ timeout: 15_000 });
    await agencySelect.selectOption(SEED_AGENCY_WITH_REFERS_TO_ID);
    await managePage
      .locator(
        `form#${domElementIds.manageConvention.transferConventionModalForm} textarea[name="justification"]`,
      )
      .fill("le candidat s'est trompé d'agence");
    managePage
      .locator(
        `#${domElementIds.manageConvention.transferToAgencySubmitButton}`,
      )
      .click();
    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });

  test("EDIT_COUNSELLOR_NAME: edits the counsellor name", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_IN_REVIEW_CONVENTION_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.editActionsButton,
      domElementIds.manageConvention.editCounsellorNameButton,
    );
    await expect(
      managePage.locator(
        `#${domElementIds.manageConvention.editCounsellorNameModal}`,
      ),
    ).toBeVisible();
    await managePage
      .locator(
        `#${domElementIds.manageConvention.editCounsellorNameModalFirstNameInput}`,
      )
      .fill("ali");
    await managePage
      .locator(
        `#${domElementIds.manageConvention.editCounsellorNameModalLastNameInput}`,
      )
      .fill("Baba");

    await managePage
      .locator(
        `#${domElementIds.manageConvention.editCounsellorNameModalSubmitButton}`,
      )
      .click();

    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });

  test("DEPRECATE: marks the convention as deprecated", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_READY_TO_SIGN_CONVENTION_2_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.cancelActionButton,
      domElementIds.manageConvention.conventionValidationDeprecateButton,
    );
    await expect(
      managePage.locator(`#${domElementIds.manageConvention.deprecatedModal}`),
    ).toBeVisible();
    await fillJustificationTextarea(
      managePage,
      domElementIds.manageConvention.deprecateModalForm,
      "Convention dépréciée pour des raisons administratives",
    );
    await managePage
      .locator(`#${domElementIds.manageConvention.deprecatedModalSubmitButton}`)
      .click();
    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });

  test("CANCEL: cancels a validated convention", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_ACCEPTED_BY_VALIDATOR_CONVENTION_2_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.cancelActionButton,
      domElementIds.manageConvention.conventionValidationCancelButton,
    );
    await expect(
      managePage.locator(`#${domElementIds.manageConvention.cancelModal}`),
    ).toBeVisible();
    await fillJustificationTextarea(
      managePage,
      domElementIds.manageConvention.cancelModalForm,
      "Annulation à la demande du bénéficiaire",
    );
    await managePage
      .locator(`#${domElementIds.manageConvention.cancelModalSubmitButton}`)
      .click();
    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });

  test("REJECT: rejects a convention before validation", async () => {
    await navigateToAgencyDashboardMain(agencyDashboardPage);
    const managePage = await openManageConventionPageFromDashboard(
      agencyDashboardPage,
      SEED_PARTIALLY_SIGNED_CONVENTION_ID,
    );
    await clickbuttonInSubMenu(
      managePage,
      domElementIds.manageConvention.cancelActionButton,
      domElementIds.manageConvention.conventionValidationRejectButton,
    );
    await expect(
      managePage.locator(`#${domElementIds.manageConvention.rejectedModal}`),
    ).toBeVisible();
    await fillJustificationTextarea(
      managePage,
      domElementIds.manageConvention.rejectedModalForm,
      "Convention refusée pour des raisons administratives",
    );
    await managePage
      .locator(`#${domElementIds.manageConvention.rejectedModalSubmitButton}`)
      .click();
    await expect(
      managePage.locator(".fr-alert--success").first(),
    ).toBeVisible();
    await managePage.close();
  });
});
