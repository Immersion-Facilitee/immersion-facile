import { expect, test } from "@playwright/test";
import { domElementIds, frontRoutes, getSiretInfoSchema } from "shared";

test("fills the convention from the real SIRET service", async ({ page }) => {
  // Public establishment, deliberately absent from InMemorySiretGateway.
  const siret = "13003013300016";
  await page.goto(frontRoutes.initiateConvention().href);
  await page
    .locator(`#${domElementIds.initiateConvention.navCards.candidate}`)
    .click();
  await page
    .locator(`#${domElementIds.initiateConvention.otherStructureButton}`)
    .click();
  await page
    .locator(".fr-accordion")
    .nth(2)
    .locator(".fr-accordion__btn")
    .click();

  const [response] = await Promise.all([
    page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(`/siret/${siret}`),
    ),
    page
      .locator(`#${domElementIds.conventionImmersion.conventionSection.siret}`)
      .fill(siret),
  ]);
  expect(response.ok()).toBe(true);
  const establishment = getSiretInfoSchema.parse(await response.json());
  if (typeof establishment === "string") throw new Error(establishment);
  expect(establishment.siret).toBe(siret);
  expect(establishment.isOpen).toBe(true);
  expect(establishment.businessName.trim()).not.toBe("");
  expect(establishment.businessAddress.trim()).not.toBe("");
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.conventionSection.businessName}`,
    ),
  ).toHaveValue(establishment.businessName);
  await expect(
    page.locator(
      `#${domElementIds.conventionImmersion.establishmentRepresentativeSection.firstName}`,
    ),
  ).toBeEnabled();
});
