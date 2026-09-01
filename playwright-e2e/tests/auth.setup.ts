import { expect, type Page, test as setup } from "@playwright/test";
import { domElementIds, frontRoutes } from "shared";
import { testConfig } from "../custom.config";
import { acceptCookiesIfBannerVisible } from "../utils/utils";

const { adminAuthFile, establishmentAuthFile, agencyAuthFile } = testConfig;

setup.describe.configure({ mode: "parallel" });

setup("authenticate as admin", async ({ page }) => {
  console.time("auth-admin");
  await page.goto("/");
  await acceptCookiesIfBannerVisible(page);
  const adminButton = await page.locator("#fr-header-main-navigation-button-4");
  await loginWithIdentityProvider(page, "admin", "ProConnect");
  await expect(adminButton).toBeVisible();
  await page.context().storageState({ path: adminAuthFile });
  console.timeEnd("auth-admin");
});

setup("authenticate as IC user establishment", async ({ page }) => {
  console.time("auth-establishment");
  await page.goto("/");
  await acceptCookiesIfBannerVisible(page);
  await loginWithIdentityProvider(page, "establishmentDashboard", "ProConnect");
  await expect(page.locator(".fr-tabs__list")).toBeVisible();
  await page.context().storageState({ path: establishmentAuthFile });
  console.timeEnd("auth-establishment");
});

setup("authenticate as IC user agency", async ({ page }) => {
  console.time("auth-agency");
  await page.goto("/");
  await acceptCookiesIfBannerVisible(page);

  await loginWithIdentityProvider(page, "agencyDashboard", "ProConnect");
  await expect(
    page.locator(`#${domElementIds.agencyDashboard.registerAgencies.search}`),
  ).toBeVisible();

  await page.context().storageState({ path: agencyAuthFile });
  console.timeEnd("auth-agency");
});

type ProviderMode = "ProConnect";

const loginWithIdentityProvider = async (
  page: Page,
  routeName: "agencyDashboard" | "establishmentDashboard" | "admin",
  identityProviderMode: ProviderMode,
) => {
  const {
    proConnectLoginButtonId,
    navLink,
    username,
    password,
    headerNavLink,
  } = buttonByRouteName(identityProviderMode)[routeName];

  if (routeName === "admin") {
    await page.goto("/admin");
    await expect(page.url()).toContain(frontRoutes[routeName]().href);
  } else {
    await page.goto("/");
    await page.click(`#${headerNavLink}`);
    await page.click(`#${navLink}`);
    await expect(page.url()).toContain(frontRoutes[routeName]().href);
  }

  const currentPage = await page.url();

  await expect(
    page.locator(`#${domElementIds.loginPersona.radioButtons}-1`),
  ).toBeChecked();

  const authButton = await page.locator(`#${proConnectLoginButtonId} .fr-btn`);
  await expect(authButton).toBeVisible();

  await authButton.click();
  await page.waitForURL(
    `${getAuthEnvVarByIdentityProviderMode(identityProviderMode).baseUrl}/**`,
  );
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector("input[name=email]");
  await page.fill("input[name=email]", username);

  if (identityProviderMode === "ProConnect")
    await page
      .locator("button[type='submit']")
      .getByText("Continuer", {
        exact: false,
      })
      .click();

  await page.fill("input[name=password]", password);

  identityProviderMode === "ProConnect"
    ? await page.getByRole("button", { name: /identifier/ }).click()
    : await page
        .locator("button[type='submit']")
        .getByText("Connexion", {
          exact: false,
        })
        .click();

  await page.waitForURL(currentPage);
  expect(page.url()).toContain(frontRoutes[routeName]().href);
};

type ConnectedUserRoute =
  | "agencyDashboard"
  | "establishmentDashboard"
  | "admin";

const buttonByRouteName = (
  identityProviderMode: ProviderMode,
): Record<
  ConnectedUserRoute,
  {
    proConnectLoginButtonId: string;
    navLink: string;
    username: string;
    password: string;
    headerNavLink?: string;
  }
> => {
  const { username, password, adminUsername, adminPassword } =
    getAuthEnvVarByIdentityProviderMode(identityProviderMode);

  return {
    agencyDashboard: {
      proConnectLoginButtonId:
        domElementIds.agencyDashboard.login.proConnectButton,
      navLink: domElementIds.header.navLinks.agency.dashboard,
      username,
      password,
      headerNavLink: "fr-header-main-navigation-button-3",
    },
    establishmentDashboard: {
      proConnectLoginButtonId:
        domElementIds.establishmentDashboard.login.proConnectButton,
      navLink: domElementIds.header.navLinks.establishment.dashboard,
      username,
      password,
      headerNavLink: "fr-header-main-navigation-button-2",
    },
    admin: {
      proConnectLoginButtonId: domElementIds.admin.login.proConnectButton,
      navLink: domElementIds.header.navLinks.admin.backOffice,
      username: adminUsername,
      password: adminPassword,
    },
  };
};

const getAuthEnvVarByIdentityProviderMode = (
  identityProviderMode: ProviderMode,
) => {
  if (identityProviderMode === "ProConnect") return testConfig.proConnect;

  throw new Error(`Unsupported Provider mode ${identityProviderMode}`);
};
