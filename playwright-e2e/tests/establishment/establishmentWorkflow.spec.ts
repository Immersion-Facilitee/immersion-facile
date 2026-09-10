import { faker } from "@faker-js/faker/locale/fr";
import { addMonths } from "date-fns";
import { domElementIds, FormEstablishmentDtoBuilder } from "shared";
import { testConfig } from "../../custom.config";
import { goToAdminTab } from "../../utils/admin";
import { getFormEstablishmentApiPath } from "../../utils/apiRoutes";
import { e2eSiretEstablishments } from "../../utils/siret";
import { test, validPhonesData } from "../../utils/utils";
import { createEstablishmentForm } from "./createNewEstablishment";
import type { MakeFormEstablishmentFromRetryNumber } from "./establishmentForm.utils";
import { goToManageEtablishmentBySiretInAdmin as goToManageEtablishmentInBackOfficeAdmin } from "./establishmentNavigation.utils";
import {
  checkAvailabilityThoughBackOfficeAdmin,
  checkAvailabilityThoughEstablishmentDashboard,
  checkEstablishmentUpdatedThroughBackOfficeAdmin,
  deleteEstablishmentInBackOfficeAdmin,
} from "./manageEstablishment";
import {
  updateEstablishmentAvailabilityThroughBackOfficeAdmin,
  updateEstablishmentThroughEstablishmentDashboard,
} from "./modifyEstablishment";
import { searchEstablishmentAndExpectResultToHaveLength } from "./searchEstablishment";

test.describe("Establishment creation and modification workflow", () => {
  test.describe.configure({ mode: "serial" });
  const testEstablishments = e2eSiretEstablishments;

  const makeInitialEstablishmentInformations: MakeFormEstablishmentFromRetryNumber =
    (retryIndex) => {
      const { siret, businessName, expectedAddress } =
        testEstablishments[retryIndex];
      return FormEstablishmentDtoBuilder.valid()
        .withSiret(siret)
        .withContactMode("PHONE")
        .withBusinessName(businessName)
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            email: testConfig.proConnect.username,
            job: faker.person.jobType(),
            phone: validPhonesData.establishmentRepresentative,
            shouldReceiveDiscussionNotifications: true,
            isMainContactByPhone: false,
          },
        ])
        .withBusinessAddresses([
          {
            id: "",
            rawAddress: expectedAddress,
          },
        ])
        .build();
    };

  const makeUpdatedEstablishment: MakeFormEstablishmentFromRetryNumber = (
    retryIndex,
  ) =>
    new FormEstablishmentDtoBuilder(
      makeInitialEstablishmentInformations(retryIndex),
    )
      .withBusinessNameCustomized("Successfully updated establishment")
      .withAdditionalInformation(
        "Successfully updated establishment description",
      )
      .withMaxContactsPerMonth(7)
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          email: testConfig.proConnect.username,
          job: "Successfully updated job",
          phone: "0165754860",
          shouldReceiveDiscussionNotifications: true,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          email:
            "recette+copy-updated-establishment2@immersion-facile.beta.gouv.fr",
          shouldReceiveDiscussionNotifications: false,
        },
      ])
      .withContactMode("PHONE")
      .withSearchableBy({
        students: false,
        jobSeekers: true,
      })
      .withNextAvailabilityDate(addMonths(new Date(), 1))
      .withBusinessAddresses([
        {
          id: "fake-id",
          rawAddress: "6 rue de la chaîne 86000 Poitiers",
        },
      ])
      .withWebsite("https://new.website.com")
      .withFitForDisabledWorkers("yes-ft-certified")
      .withIsEngagedEnterprise(true)
      .build();

  test.describe("Cleanup stale establishments from previous runs", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    for (const { siret } of testEstablishments) {
      test(`delete establishment ${siret} if it already exists`, async ({
        page,
      }) => {
        page.on("dialog", (dialog) => dialog.accept());
        await page.goto("/");
        await goToAdminTab(page, "adminEstablishments");
        const siretInput = page.locator(
          `#${domElementIds.admin.manageEstablishment.siretInput}`,
        );
        await siretInput.waitFor();
        await siretInput.fill(siret);
        const formEstablishmentApiPath = getFormEstablishmentApiPath(siret);
        const [establishmentResponse] = await Promise.all([
          page.waitForResponse((response) =>
            response.url().includes(formEstablishmentApiPath),
          ),
          page.click(
            `#${domElementIds.admin.manageEstablishment.searchButton}`,
          ),
        ]);
        if (establishmentResponse.status() === 404) return;

        const deleteButton = page.locator(
          `#${domElementIds.admin.manageEstablishment.submitDeleteButton}`,
        );
        await deleteButton.waitFor({ timeout: 10_000 });
        await deleteButton.click();
      });
    }
  });

  test.describe("Create & update establishment as establishment admin", () => {
    test.use({ storageState: testConfig.establishmentAuthFile });
    test(
      "creates a new establishment",
      createEstablishmentForm(makeInitialEstablishmentInformations),
    );

    test(
      "modifies an existing establishment through establishment dashboard",
      updateEstablishmentThroughEstablishmentDashboard(
        makeUpdatedEstablishment,
      ),
    );

    test(
      "checks that establishment is unavailable through establishment dashboard",
      checkAvailabilityThoughEstablishmentDashboard(makeUpdatedEstablishment),
    );
  });

  test.describe("Check establishment as backoffice admin", () => {
    test.use({ storageState: testConfig.adminAuthFile });

    test(
      "check that establishment has been updated through backoffice admin",
      checkEstablishmentUpdatedThroughBackOfficeAdmin(makeUpdatedEstablishment),
    );
  });

  test(
    "searches for non available establishment",
    searchEstablishmentAndExpectResultToHaveLength(makeUpdatedEstablishment, 0),
  );

  test.describe("Admin makes the establishment available", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test(
      "make the establishment available",
      updateEstablishmentAvailabilityThroughBackOfficeAdmin(
        makeUpdatedEstablishment,
      ),
    );
  });

  test(
    "searches for available establishment",
    searchEstablishmentAndExpectResultToHaveLength(makeUpdatedEstablishment, 1),
  );

  test.describe("Check displayed availability", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test(
      "in backoffice admin manage establishment",
      checkAvailabilityThoughBackOfficeAdmin(makeUpdatedEstablishment),
    );
  });

  test.describe("Admin deletes an establishment", () => {
    test.use({ storageState: testConfig.adminAuthFile });
    test("deletes an establishment", async ({ page }, { retry }) => {
      const updatedEstablishment = makeUpdatedEstablishment(retry);
      page.on("dialog", (dialog) => dialog.accept());
      await goToManageEtablishmentInBackOfficeAdmin(
        page,
        updatedEstablishment.siret,
      );
      await deleteEstablishmentInBackOfficeAdmin(page);
    });
  });
});
