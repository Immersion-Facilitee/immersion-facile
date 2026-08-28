import { expect, type Page } from "@playwright/test";
import {
  domElementIds,
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
    frontRoutes.establishmentDashboardFormEstablishment({
      siret: establishment.siret,
    }).href;
  if (!page.url().includes(establishmentDashboardUrl)) {
    await page
      .locator(
        `#${domElementIds.establishmentDashboard.manageEstablishments.selectEstablishmentInput}`,
      )
      .selectOption(establishment.siret);
  }
  await page.waitForURL(establishmentDashboardUrl);
};

export const goToManageEtablishmentBySiretInAdmin = async (
  page: Page,
  siret: SiretDto,
) => {
  await page.goto("/");
  await goToAdminTab(page, "adminEstablishments");
  const siretInputLocator = page.locator(
    `#${domElementIds.admin.manageEstablishment.siretInput}`,
  );
  await siretInputLocator.waitFor();
  await siretInputLocator.fill(siret);
  const formEstablishmentApiPath = getFormEstablishmentApiPath(siret);
  const establishmentResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(formEstablishmentApiPath) &&
      response.status() === 200,
  );
  await page.click(`#${domElementIds.admin.manageEstablishment.searchButton}`);
  await establishmentResponsePromise;

  await waitForVisibleLoaderHidden(page, ".im-loader");

  await expect(page.url()).toContain(`establishments/${siret}`);
};
