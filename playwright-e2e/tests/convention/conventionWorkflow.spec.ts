import { faker } from "@faker-js/faker";
import test, { expect } from "@playwright/test";
import { domElementIds, frontRoutes } from "shared";
import { testConfig } from "../../custom.config";
import {
  getMagicLinkAndRecipientFromEmail,
  getMagicLinkFromEmail,
  getMagicLinkLocatorFromEmail,
  goToAdminTab,
  openConnectedConventionAsRecipient,
} from "../../utils/admin";
import {
  allOtherSignatoriesSignConvention,
  type ConventionSubmitted,
  checkConventionSummary,
  confirmCreateConventionFormSubmit,
  getSignatureLinksAndRecipients,
  goToFormPageAndFillConventionForm,
  type SignatureLinkAndRecipient,
  shareConventionDraftByEmail,
  signConvention,
  submitBasicConventionForm,
  submitEditConventionForm,
  tomorrowDateDisplayed,
  updatedEndDateDisplayed,
} from "../../utils/convention";

test.describe.configure({ mode: "serial" });

test.describe("Convention can be created from shared draft", () => {
  test.use({ storageState: testConfig.adminAuthFile });

  test("creates a new convention from shared draft", async ({ page }) => {
    await goToFormPageAndFillConventionForm(page);
    await shareConventionDraftByEmail(page);
    await goToAdminTab(page, "adminNotifications");
    const href = await getMagicLinkFromEmail({
      page,
      emailType: "SHARE_CONVENTION_DRAFT_SENDER",
      label: "conventionFormUrl",
    });
    expect(href).not.toBe(null);
    if (!href) throw new Error("Convention draft magic link not found");
    await page.goto(href);
    await page.click(
      `#${domElementIds.conventionImmersion.fromSharedConventionContinueButton}`,
    );
    await confirmCreateConventionFormSubmit(page, tomorrowDateDisplayed);
  });
});

test.describe("Convention creation and modification workflow", () => {
  let conventionSubmitted: ConventionSubmitted | void;

  test("creates a new convention", async ({ page }) => {
    conventionSubmitted = await submitBasicConventionForm(page);
    await page.waitForTimeout(testConfig.timeForEventCrawler);
  });

  test.describe("Convention admin get notifications magic links", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test.describe("convention initial signatures before modification", () => {
      const signatoriesCount = 2;
      let signatories: SignatureLinkAndRecipient[];

      test("get signatories magicLink urls from email", async ({ page }) => {
        signatories = await getSignatureLinksAndRecipients({
          page,
          count: signatoriesCount,
        });
        await expect(signatories).toHaveLength(signatoriesCount);
      });

      test("first two signatories signs the convention", async ({ page }) => {
        await signConvention(
          page,
          signatories[0].href,
          signatories[0].recipientEmail,
          tomorrowDateDisplayed,
        );
      });

      test.describe("last signatory signs convention from Martinique", () => {
        test.use({
          timezoneId: "America/Martinique",
        });
        test("signs convention for signatory 4", async ({ page }) => {
          await signConvention(
            page,
            signatories[1].href,
            signatories[1].recipientEmail,
            tomorrowDateDisplayed,
          );
        });
      });
    });

    test.describe("convention modification adding other signatories", () => {
      test.use({
        timezoneId: "Europe/Paris",
      });

      test("validator does the modification", async ({ page }) => {
        await page.goto("/");
        const validatorMagicLinkLocator = await getMagicLinkLocatorFromEmail({
          page,
          emailType: "NEW_CONVENTION_AGENCY_NOTIFICATION",
          elementIndex: 0,
          label: "manageConventionLink",
        });
        await validatorMagicLinkLocator.click();

        await page
          .locator(`#${domElementIds.manageConvention.editActionsButton}`)
          .click();
        await page
          .locator(`#${domElementIds.manageConvention.editLink}`)
          .click();

        await expect(
          page.locator(
            `#${domElementIds.conventionImmersion.form({
              internshipKind: "immersion",
              mode: "edit-convention",
            })}`,
          ),
        ).toBeVisible();

        await submitEditConventionForm(page, conventionSubmitted);
      });

      test("then first signatory also edit the convention (his submission also signs the convention)", async ({
        page,
      }) => {
        test.setTimeout(90_000);
        await page.goto("/");
        const { href, recipientEmail } =
          await getMagicLinkAndRecipientFromEmail({
            page,
            emailType:
              "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
            elementIndex: 0,
            label: "conventionSignatureLink",
          });
        expect(href).toBeTruthy();
        expect(recipientEmail).toBeTruthy();

        const { page: recipientPage, context } =
          await openConnectedConventionAsRecipient(
            page,
            href!,
            recipientEmail!,
          );

        await recipientPage
          .locator(`#${domElementIds.manageConvention.editLink}`)
          .click();

        await expect(
          recipientPage.locator(
            `#${domElementIds.conventionImmersion.form({
              internshipKind: "immersion",
              mode: "edit-convention",
            })}`,
          ),
        ).toBeVisible();

        await recipientPage
          .locator(`#${domElementIds.conventionImmersion.submitFormButton}`)
          .click();

        await recipientPage.fill(
          `#${domElementIds.conventionImmersion.statusJustificationInput}`,
          "justification de la modification",
        );

        await recipientPage
          .getByRole("button", { name: "Signer la convention" })
          .click();
        await recipientPage
          .getByRole("button", { name: "Je termine la signature" })
          .click();

        await recipientPage.waitForURL(
          `**${frontRoutes.manageConventionConnectedUser({}).href}**`,
        );
        await checkConventionSummary(recipientPage, updatedEndDateDisplayed);
        await expect(
          recipientPage.locator(
            `#${domElementIds.manageConvention.openSignModalButton}`,
          ),
        ).toBeHidden();

        await context.close();
      });
    });

    test.describe("convention signatures after modification", () => {
      test("all other signatories sign the convention", async ({ page }) => {
        test.setTimeout(120_000);
        await allOtherSignatoriesSignConvention({
          page,
          expectedConventionEndDate: updatedEndDateDisplayed,
        });
      });
    });

    test.describe("convention review and validation", () => {
      test("reviews and validate convention", async ({ page }) => {
        await page.goto("/");
        const href = await getMagicLinkFromEmail({
          page,
          emailType: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
          elementIndex: 0,
          label: "manageConventionLink",
        });
        expect(href).not.toBe(null);
        if (!href)
          throw new Error("Convention validation magic link not found");
        await page.goto(href);
        await page
          .locator(
            `#${domElementIds.manageConvention.conventionValidationValidateButton}`,
          )
          .click();
        await page
          .locator(
            `#${domElementIds.manageConvention.validatorModalLastNameInput}`,
          )
          .fill(faker.person.lastName());
        await page
          .locator(
            `#${domElementIds.manageConvention.validatorModalFirstNameInput}`,
          )
          .fill(faker.person.firstName());
        await page
          .locator(
            `#${domElementIds.manageConvention.validatorModalSubmitButton}`,
          )
          .click();
        await expect(page.locator(".fr-alert--success")).toBeVisible();
      });
    });
  });
});

test.describe("Convention creation and modification workflow in Martinique", () => {
  test.use({
    timezoneId: "America/Martinique",
  });
  test("creates a new convention on a client in Martinique", async ({
    page,
  }) => {
    await submitBasicConventionForm(page);
  });
});
