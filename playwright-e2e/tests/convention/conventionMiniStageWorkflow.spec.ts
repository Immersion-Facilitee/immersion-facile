import test, { expect } from "@playwright/test";
import { domElementIds } from "shared";
import {
  goToMiniStageFormPage,
  miniStageAdultBirthdate,
  miniStageMinorBirthdate,
  openConventionAccordionSection,
  submitBasicMiniStageConventionForm,
} from "../../utils/convention";

test.describe("Mini-stage convention creation", () => {
  test("creates convention for minor with establishment", async ({ page }) => {
    const conventionSubmitted = await submitBasicMiniStageConventionForm(page);
    expect(conventionSubmitted.conventionId).toBeTruthy();
    await expect(
      page.locator(
        `#${domElementIds.conventionImmersion.conventionConfirmation.copyConventionIdButton}`,
      ),
    ).toBeVisible();
  });

  test("shows age-dependent beneficiary fields", async ({ page }) => {
    await goToMiniStageFormPage(page);
    await openConventionAccordionSection(page, 1);

    const birthdateInput = page.locator(
      `#${domElementIds.conventionImmersion.beneficiarySection.birthdate}`,
    );
    const isMinorRadio = page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.isMinor}`,
    );
    const representativeFirstName = page.locator(
      `#${domElementIds.conventionImmersion.beneficiaryRepresentativeSection.firstName}`,
    );
    const emergencyContact = page.locator(
      `#${domElementIds.conventionImmersion.beneficiarySection.emergencyContact}`,
    );

    await birthdateInput.fill(miniStageMinorBirthdate);
    await expect(representativeFirstName).toBeVisible();
    await expect(isMinorRadio).toBeHidden();
    await expect(emergencyContact).toBeHidden();

    await birthdateInput.fill(miniStageAdultBirthdate);
    await expect(isMinorRadio).toBeVisible();
    await expect(representativeFirstName).toBeHidden();
    await expect(emergencyContact).toBeVisible();
  });
});
