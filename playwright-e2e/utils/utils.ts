import {
  test as base,
  expect,
  type Locator,
  type Page,
  type PlaywrightTestArgs,
  type TestInfo,
} from "@playwright/test";
import type { RemoteWorkMode } from "shared";

export type PlaywrightTestCallback = (
  args: PlaywrightTestArgs,
  info: TestInfo,
) => Promise<void>;

export const validPhonesData = {
  beneficiary: "0601010101",
  beneficiaryRepresentative: "0249030304",
  beneficiaryCurrentEmployer: "0605050505",
  establishmentTutor: "0549030303",
  establishmentRepresentative: "0604040404",
  agency: "0605050505",
};

export const expectElementToBeVisible = async (
  page: Page,
  selector: string,
) => {
  const element = await page.locator(selector).first();
  await element.waitFor();
  await expect(element).toBeVisible();
};

export const fillAutocomplete = async ({
  page,
  locator,
  value,
  endpoint,
}: {
  page: Page;
  locator: string;
  value: string;
  endpoint?: string;
}) => {
  const controlWrapper = page.locator(".im-select__control", {
    has: page.locator(locator),
  });
  const clearButton = controlWrapper.locator(".im-select__clear-indicator");
  if (await clearButton.isVisible()) {
    await clearButton.click();
  }

  await page.locator(locator).pressSequentially(value, {
    delay: 50,
  });

  if (endpoint)
    await page.waitForResponse(
      (response) =>
        response.url().includes(endpoint) && response.status() === 200,
      { timeout: 15_000 },
    );

  const listbox = page.locator(locator);
  await listbox.waitFor();
  const listboxId = await listbox.getAttribute("aria-controls");
  await expect(listboxId).not.toBeNull();
  const options = page.locator(
    `#${listboxId} > div:not(.im-select__menu-notice--loading, .im-select__menu-notice--no-options)`,
  );
  const firstOption = options.first();
  await expect(firstOption).toBeVisible({ timeout: 10_000 });
  await firstOption.click();
};

export const logHttpResponse = ({
  page,
  onlyErrors,
}: {
  page: Page;
  onlyErrors?: boolean;
}) => {
  page.on("response", async (response) => {
    if (
      onlyErrors &&
      response.status() >= 400 &&
      response.url().includes("/api/")
    ) {
      console.info(
        "<<",
        response.request().method(),
        response.status(),
        response.url(),
        (await response.body()).toString(),
      );
    } else if (response.url().includes("/api/")) {
      console.info(
        "<<",
        response.request().method(),
        response.status(),
        response.url(),
        await response.text(),
      );
    }
  });
};

export const expectLocatorToBeVisibleAndEnabled = async (
  locator: Locator,
): Promise<void> => {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
};

export const expectLocatorToBeReadOnly = async (
  locator: Locator,
): Promise<void> => {
  await expect(locator).toBeVisible();
  await expect(locator).not.toBeEditable();
};

export const acceptCookiesIfBannerVisible = async (page: Page) => {
  const acceptAllButton = page
    .getByRole("region", { name: "Gestion des cookies" })
    .getByRole("button", { name: "Tout accepter" });
  if (await acceptAllButton.isVisible()) await acceptAllButton.click();
};

export const expectNoErrorVisible = async (page: Page) => {
  await expect(page.locator(".fr-alert--error")).not.toBeVisible();
};

export const waitForVisibleLoaderHidden = async (
  page: Page,
  loaderKind: ".im-loader__overlay" | ".im-loader",
) => {
  const loader = page.locator(loaderKind);
  if (await loader.isVisible())
    await loader.waitFor({ state: "hidden", timeout: 10_000 });
};

export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    const prefix = `[${testInfo.file} > ${testInfo.title}]`;

    context.on("page", (page) => {
      page.on("crash", () => {
        console.log(`${prefix} PAGE CRASH`);
      });

      page.on("pageerror", (err) => {
        console.log(`${prefix} PAGE ERROR: ${err.message}`);
        console.log(err.stack);
      });

      page.on("console", (msg) => {
        if (
          !process.env.CI ||
          msg.type() === "warning" ||
          msg.type() === "error"
        )
          console.log(
            `${prefix} BROWSER CONSOLE [${msg.type()}]: ${msg.text()}`,
          );
      });

      page.on("requestfailed", (req) => {
        console.log(
          `${prefix} REQUEST FAILED: ${req.method()} ${req.url()} -> ${req.failure()?.errorText}`,
        );
      });
    });

    await use(context);
  },
});

export { expect } from "@playwright/test";

export const remoteModeIndexMap: Record<RemoteWorkMode, number> = {
  ON_SITE: 0,
  HYBRID: 1,
  FULL_REMOTE: 2,
};
