import { expect, test } from "@playwright/test";
import { testConfig } from "../../custom.config";
import {
  fillAndSubmitBasicAgencyForm,
  rejectAgencyInAdmin,
} from "../../utils/agency";

test.describe.configure({ mode: "serial" });

test.describe("Agency workflow", () => {
  let agencyAddedName: string | null = null;
  const makeAgencyOverride = (seed: string) => ({
    customizedName: `Cap emploi de Bayonne ${seed}`,
    validatorEmail: `valideur+${seed}@cap.com`,
    agencyContactEmail: `contact+${seed}@cap.com`,
  });

  test.describe("Agency creation", () => {
    test.use({ storageState: testConfig.agencyAuthFile });

    test("Can add an agency (prescripteur), with one step of validators", async ({
      page,
    }) => {
      const seed = `agency-creation-r${test.info().retry}`;
      const override = makeAgencyOverride(seed);
      agencyAddedName = override.customizedName;
      await fillAndSubmitBasicAgencyForm(page, override);
      await expect(page.locator(".fr-alert--success")).toBeVisible();
    });
  });

  test.describe("Agency rejection in admin", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test("Rejects an agency in backoffice", async ({ page }) => {
      if (!agencyAddedName) throw new Error("agencyAddedName is null");
      await rejectAgencyInAdmin(page, agencyAddedName);
    });
  });
});
