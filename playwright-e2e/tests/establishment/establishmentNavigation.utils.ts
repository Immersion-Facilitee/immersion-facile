import { expect, type Page } from "@playwright/test";
import {
  domElementIds,
  establishmentRoutes,
  type FormEstablishmentDto,
  frontRoutes,
  type SiretDto,
} from "shared";
import { goToAdminTab } from "../../utils/admin";
import { getFormEstablishmentApiPath } from "../../utils/apiRoutes";
import {
  goToDashboard,
  goToEstablishmentDashboardTab,
} from "../../utils/dashboard";
import { waitForVisibleLoaderHidden } from "../../utils/utils";

export const goToManageEstablishmentThroughEstablishmentDashboard = async (
  page: Page,
  establishment: FormEstablishmentDto,
) => {
  await page.goto("/");
  await goToDashboard(page, "establishment");
  await expect(await page.locator(".fr-tabs__list li")).toHaveCount(3);
  await goToEstablishmentDashboardTab(page, "fiche-entreprise");

  const establishmentDashboardUrl =
    frontRoutes.establishmentDashboardEstablishmentDetails({
      siret: establishment.siret,
    }).href;
  await page
    .locator(
      `#${domElementIds.establishmentDashboard.manageEstablishments.manageEstablishmentButton}-${establishment.siret}`,
    )
    .click();
  await page.waitForURL(establishmentDashboardUrl);
};

export const goToManageEtablishmentBySiretInAdmin = async (
  page: Page,
  siret: SiretDto,
) => {
  await page.goto("/");
  await goToAdminTab(page, "adminEstablishments");
  await page
    .getByRole("search", { name: "Rechercher", exact: true })
    .fill(siret);
  const [searchResponse] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith(
          establishmentRoutes.getEstablishmentsForAdmin.url,
        ) && url.searchParams.get("search") === siret
      );
    }),
    page.getByRole("button", { name: "Rechercher", exact: true }).click(),
  ]);
  expect(searchResponse.ok()).toBe(true);

  const formEstablishmentApiPath = getFormEstablishmentApiPath(siret);
  const establishmentResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(formEstablishmentApiPath) &&
      response.status() === 200,
  );
  await page
    .locator(
      `#${domElementIds.adminEstablishments.establishmentListEditEstablishmentButton}--${siret}`,
    )
    .click();
  await establishmentResponsePromise;

  await waitForVisibleLoaderHidden(page, ".im-loader");

  await expect(page.url()).toContain(`establishments/${siret}`);
};
