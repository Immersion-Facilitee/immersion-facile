import { type Email, expectToEqual } from "shared";
import { createFetchSharedClient } from "shared-routes/fetch";
import { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { EstablishmentMarketingGatewayDto } from "../../ports/EstablishmentMarketingGateway";
import { brevoContactRoutes } from "./BrevoContact.routes";
import {
  type BrevoContact,
  BrevoEstablishmentMarketingGateway,
} from "./BrevoEstablishmentMarketingGateway";

const mode = ["full", "mini"] as const;
type Mode = (typeof mode)[number];

describe("BrevoEstablishmentMarketingGateway", () => {
  const config = AppConfig.createFromEnv();
  const gateway = new BrevoEstablishmentMarketingGateway({
    httpClient: createFetchSharedClient(brevoContactRoutes, fetch),
    apiKey: config.apiKeyBrevo,
    establishmentContactListId: config.brevoEstablishmentContactListId,
  });

  it("create/update/delete new contact", async () => {
    const contactFull = makeEstablishmentMarketingGatewayDto("full");
    const contactMini = makeEstablishmentMarketingGatewayDto("mini");

    expectToEqual(
      await gateway.getContactByEmail(contactFull.email),
      undefined,
    );

    await gateway.save(contactFull);

    expectToEqual(await gateway.getContactByEmail(contactFull.email), {
      contact: contactFull,
      lists: [config.brevoEstablishmentContactListId],
    });

    expect(await gateway.getContactByEmail(contactFull.email)).toBeDefined();

    await gateway.save(contactMini);

    expectToEqual(await gateway.getContactByEmail(contactMini.email), {
      contact: contactMini,
      lists: [config.brevoEstablishmentContactListId],
    });

    await gateway.delete(contactMini.email);

    expectToEqual(
      await gateway.getContactByEmail(contactFull.email),
      undefined,
    );
  });

  it("update existing contact in another list with attributes and keep contact on existing list on delete", async () => {
    const existingContactEmail: Email = "bbohec.pro@gmail.com";
    const contactEmailNotInEstablishmentList: BrevoContact = {
      contact: {
        email: existingContactEmail,
        conventions: {
          numberOfValidatedConvention: -1,
        },
        firstName: "",
        lastName: "",
        numberEmployeesRange: "0",
        siret: "",
        hasIcAccount: false,
        isRegistered: false,
      },
      lists: [25],
    };

    expectToEqual(
      await gateway.getContactByEmail(existingContactEmail),
      contactEmailNotInEstablishmentList,
    );

    const existingContactFull = makeEstablishmentMarketingGatewayDto(
      "full",
      existingContactEmail,
    );

    await gateway.save(existingContactFull);

    expectToEqual(await gateway.getContactByEmail(existingContactEmail), {
      contact: existingContactFull,
      lists: [25, config.brevoEstablishmentContactListId],
    });

    await gateway.delete(existingContactFull.email);

    expectToEqual(
      await gateway.getContactByEmail(existingContactEmail),
      contactEmailNotInEstablishmentList,
    );
  });
});

const makeEstablishmentMarketingGatewayDto = (
  mode: Mode,
  existingEmail?: string,
): EstablishmentMarketingGatewayDto => ({
  email: existingEmail ?? "billy.idol@mail.fr",
  firstName: mode === "full" ? "Billy" : "Martin",
  lastName: mode === "full" ? "Idol" : "Solveig",
  hasIcAccount: mode === "full",
  siret: "12345678901234",
  numberEmployeesRange: mode === "full" ? "0" : "1000-1999",
  conventions:
    mode === "full"
      ? {
          numberOfValidatedConvention: 3,
          firstConventionValidationDate: new Date("2024-07-03"),
          lastConvention: {
            endDate: new Date("2024-07-26"),
            validationDate: new Date("2024-07-04"),
          },
        }
      : { numberOfValidatedConvention: 0 },
  ...(mode === "full"
    ? {
        isRegistered: true,
        maxContactsPerMonth: 100,
        nafCode: "A0178",
        numberOfDiscussionsAnswered: 100,
        numberOfDiscussionsReceived: 100,
        searchableBy: "students",
        nextAvailabilityDate: new Date("2024-07-18"),
        departmentCode: "95",
        romes: ["A2310", "B7040"],
        isSuperEstablishment: true,
      }
    : { isRegistered: false }),
});
