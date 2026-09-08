import { expect, test } from "@playwright/test";
import {
  authenticatedConventionRoutes,
  domElementIds,
  SEED_PARTIALLY_SIGNED_CONVENTION_ID,
} from "shared";
import { testConfig } from "../../custom.config";
import {
  navigateToAgencyDashboardMain,
  openManageConventionPageFromDashboard,
} from "../../utils/convention";
import { acceptCookiesIfBannerVisible } from "../../utils/utils";

test.use({ storageState: testConfig.adminAuthFile });

test("finds a convention outside the first dashboard page", async ({
  page,
}) => {
  const endpoint =
    authenticatedConventionRoutes.getConventionsForAgencyUser.url;
  // Keep the real backend and data, but force pagination without racing writers.
  await page.route(`**${endpoint}*`, async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set("perPage", "1");
    await route.continue({ url: url.toString() });
  });
  await page.goto("/");
  await acceptCookiesIfBannerVisible(page);
  const [response] = await Promise.all([
    page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(endpoint),
    ),
    navigateToAgencyDashboardMain(page),
  ]);
  expect(response.ok()).toBe(true);
  const list = await response.json();
  expect(list.pagination.totalPages).toBeGreaterThan(1);
  expect(list.data.map(({ id }: { id: string }) => id)).not.toContain(
    SEED_PARTIALLY_SIGNED_CONVENTION_ID,
  );
  await expect(
    page.locator(
      `#${domElementIds.agencyDashboard.dashboard.goToConventionButton}--${SEED_PARTIALLY_SIGNED_CONVENTION_ID}`,
    ),
  ).toHaveCount(0);

  const managePage = await openManageConventionPageFromDashboard(
    page,
    SEED_PARTIALLY_SIGNED_CONVENTION_ID,
  );
  await expect(managePage).toHaveURL(
    new RegExp(SEED_PARTIALLY_SIGNED_CONVENTION_ID),
  );
  await managePage.close();
});
