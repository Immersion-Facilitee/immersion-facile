import test, { expect, type Page } from "@playwright/test";
import {
  addressRoutes,
  domElementIds,
  formCompletionRoutes,
  frontRoutes,
} from "shared";
import {
  expectLocatorToBeVisibleAndEnabled,
  fillAutocomplete,
} from "../../utils/utils";

const makeEmptySearch = async (page: Page) => {
  await page.goto("/");
  await page.click(`#${domElementIds.home.heroHeader.candidate}`);
  await page.click(`#${domElementIds.homeCandidates.heroHeader.search}`);
  await expect(page.url()).toContain(`${frontRoutes.search().href}`);
  await expectSearchSubmitButtonToBeEnabled(page);
  await page.click(`#${domElementIds.search.searchSubmitButton}`);
  await expectSearchToHaveResults(page);
};

test.describe.configure({ mode: "serial" });

test.describe("Search", () => {
  test("can search with empty fields", async ({ page }) => {
    await makeEmptySearch(page);
  });

  test("can access a search result", async ({ page }) => {
    await makeEmptySearch(page);
    await page
      .locator(`[id^=${domElementIds.search.searchResultButton}]`)
      .first()
      .click();
    await page.getByRole("button", {
      name: "Contacter l'entreprise",
    });
  });

  test("can search with location fields and clear it", async ({ page }) => {
    const defaultPlaceAutocompleteValue = "France entière";
    const defaultAppellationsAutocompleteValue = "Tous les métiers";
    await page.goto(frontRoutes.search().href);
    await expectSearchSubmitButtonToBeEnabled(page);
    await fillAutocomplete({
      page,
      locator: `#${domElementIds.search.appellationAutocomplete}`,
      value: "Boulanger",
      endpoint: formCompletionRoutes.appellation.url,
    });
    await fillAutocomplete({
      page,
      locator: `#${domElementIds.search.placeAutocompleteInput}`,
      value: "Paris",
      endpoint: addressRoutes.lookupLocation.url,
    });
    await page.click(`#${domElementIds.search.searchSubmitButton}`);
    await expectSortFiltersToBe(page, [
      "Trier par pertinence",
      "Trier par date de publication",
      "Trier par proximité",
    ]);
    await expect(
      page.locator(
        `#${domElementIds.search.placeAutocompleteInput}-wrapper .im-select__single-value`,
      ),
    ).not.toHaveText(defaultPlaceAutocompleteValue);
    await expect(
      page.locator(
        `#${domElementIds.search.appellationAutocomplete}-wrapper .im-select__single-value`,
      ),
    ).not.toHaveText(defaultAppellationsAutocompleteValue);
    await page.locator(`#${domElementIds.search.resetFiltersButton}`).click();
    await expect(
      page.locator(
        `#${domElementIds.search.placeAutocompleteInput}-wrapper .im-select__single-value`,
      ),
    ).toHaveCount(0);
    await expect(
      page.locator(
        `#${domElementIds.search.appellationAutocomplete}-wrapper .im-select__single-value`,
      ),
    ).toHaveCount(0);
    await expectSearchToHaveResults(page);
  });
});

test.skip("checks that share URL have the correct params values", async () => {});

const expectSearchToHaveResults = async (page: Page) => {
  const searchResultsSelector = "[id^=im-search-result]";
  await page.waitForSelector(searchResultsSelector);
  await expect(
    await page.locator(searchResultsSelector).count(),
  ).toBeGreaterThan(0);
};

const expectSearchSubmitButtonToBeEnabled = async (page: Page) => {
  const searchSubmitButton = await page.locator(
    `#${domElementIds.search.searchSubmitButton}`,
  );
  await expectLocatorToBeVisibleAndEnabled(searchSubmitButton);
};

const expectSortFiltersToBe = async (page: Page, filters: string[]) => {
  await page.locator(`#${domElementIds.search.sortFilterTag}`).click();
  const sortFiltersOptions = (
    await page.locator(`#${domElementIds.search.sortRadioButtons}`).innerText()
  ).split("\n");
  await expect(await sortFiltersOptions).toEqual(filters);
};
