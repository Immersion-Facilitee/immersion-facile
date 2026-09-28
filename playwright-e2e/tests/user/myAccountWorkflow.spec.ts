import { expect } from "@playwright/test";
import { domElementIds } from "shared";
import { testConfig } from "../../custom.config";
import { test } from "../../utils/utils";

test.describe("My account workflow", () => {
  test.use({ storageState: testConfig.agencyAuthFile });

  test("ProConnect user can access its infos and quick accesses on MyAccount page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#fr-header-quick-access-item-1").click();

    await expect(
      page.locator(`#${domElementIds.myAccount.updateOwnInfosLink}`),
    ).toBeVisible();
    await expect(
      page.locator(`#${domElementIds.myAccount.beneficiaryDashboardLink}`),
    ).toBeVisible();
    await expect(
      page.locator(`#${domElementIds.myAccount.establishmentDashboardLink}`),
    ).toBeVisible();
    await expect(
      page.locator(`#${domElementIds.myAccount.agencyDashboardLink}`),
    ).toBeVisible();
  });
});
