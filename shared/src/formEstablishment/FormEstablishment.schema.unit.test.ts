import { ZodError } from "zod";
import { expectToEqual } from "../test.helpers";
import type { EstablishmentFormOffer } from "./FormEstablishment.dto";
import {
  establishmentFormOfferSchema,
  formEstablishmentSchema,
} from "./FormEstablishment.schema";
import { FormEstablishmentDtoBuilder } from "./FormEstablishmentDtoBuilder";

describe("formEstablishmentSchema", () => {
  describe("wrong paths", () => {
    it("invalid establishment : contact mode IN_PERSON but no welcome address", () => {
      const invalidFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("IN_PERSON")
        .build();
      expect(() =>
        formEstablishmentSchema.parse(invalidFormEstablishment),
      ).toThrow(
        new ZodError([
          {
            expected: "object",
            code: "invalid_type",
            path: ["potentialBeneficiaryWelcomeAddress"],
            message: "L'adresse est invalide",
          },
        ]),
      );
    });
    it("invalid establishment : contact mode IN_PERSON but no main contact in person", () => {
      const invalidFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("IN_PERSON")
        .withPotentialBeneficiaryWelcomeAddress({
          address: {
            streetNumberAndAddress: "127 rue de Grenelle 75007 Paris",
            city: "Paris",
            postcode: "75007",
            departmentCode: "75",
          },
          position: {
            lat: 48.8566,
            lon: 2.3522,
          },
        })
        .withUserRights([
          {
            email: "test@test.com",
            role: "establishment-admin",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
            phone: "0145784644",
            isMainContactByPhone: false,
            isMainContactInPerson: false,
          },
        ])
        .build();
      expect(() =>
        formEstablishmentSchema.parse(invalidFormEstablishment),
      ).toThrow(
        new ZodError([
          {
            code: "custom",
            path: ["userRights"],
            message:
              "En cas de mode de contact en personne, vous devez renseigner un contact principal.",
          },
        ]),
      );
    });
    it("invalid establishment : contact mode PHONE but no main contact by phone", () => {
      const invalidFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("PHONE")
        .withUserRights([
          {
            email: "test@test.com",
            phone: "+33612345678",
            isMainContactByPhone: false,
            role: "establishment-admin",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
          },
        ])
        .build();
      expect(() =>
        formEstablishmentSchema.parse(invalidFormEstablishment),
      ).toThrow(
        new ZodError([
          {
            code: "custom",
            path: ["userRights"],
            message:
              "En cas de mode de contact par téléphone, vous devez renseigner un contact principal par téléphone.",
          },
        ]),
      );
    });

    it("invalid establishment : only 1 establishment admin but not with status ACCEPTED", () => {
      const invalidFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("EMAIL")
        .withUserRights([
          {
            email: "test@test.com",
            phone: "+33612345678",
            isMainContactByPhone: true,
            role: "establishment-admin",
            status: "PENDING",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
          },
        ])
        .build();

      expect(() =>
        formEstablishmentSchema.parse(invalidFormEstablishment),
      ).toThrow(
        new ZodError([
          {
            code: "custom",
            path: ["userRights"],
            message:
              "La structure accueillante nécessite au moins un administrateur pour être valide.",
          },
          {
            code: "custom",
            path: ["userRights"],
            message:
              "La structure accueillante nécessite au moins qu'une personne reçoive les notifications liées aux candidatures.",
          },
        ]),
      );
    });
  });

  describe("right paths", () => {
    it("valid basic establishment", () => {
      const validFormEstablishment =
        FormEstablishmentDtoBuilder.valid().build();
      expectToEqual(
        formEstablishmentSchema.parse(validFormEstablishment),
        validFormEstablishment,
      );
    });
    it("valid establishment IN_PERSON with welcome address", () => {
      const validFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("IN_PERSON")
        .withUserRights([
          {
            email: "test@test.com",
            phone: "+33612345678",
            isMainContactByPhone: false,
            isMainContactInPerson: true,
            role: "establishment-admin",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
          },
        ])
        .withPotentialBeneficiaryWelcomeAddress({
          address: {
            streetNumberAndAddress: "127 rue de Grenelle 75007 Paris",
            city: "Paris",
            postcode: "75007",
            departmentCode: "75",
          },
          position: {
            lat: 48.8566,
            lon: 2.3522,
          },
        })
        .build();

      expectToEqual(
        formEstablishmentSchema.parse(validFormEstablishment),
        validFormEstablishment,
      );
    });

    it("valid establishment PHONE with at least one main contact by phone", () => {
      const validFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("PHONE")
        .withUserRights([
          {
            email: "test@test.com",
            phone: "+33612345678",
            isMainContactByPhone: true,
            role: "establishment-admin",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
          },
        ])
        .build();

      expectToEqual(
        formEstablishmentSchema.parse(validFormEstablishment),
        validFormEstablishment,
      );
    });
    it("valid establishment IN_PERSON with main contact in person", () => {
      const validFormEstablishment = FormEstablishmentDtoBuilder.valid()
        .withContactMode("IN_PERSON")
        .withPotentialBeneficiaryWelcomeAddress({
          address: {
            streetNumberAndAddress: "127 rue de Grenelle 75007 Paris",
            city: "Paris",
            postcode: "75007",
            departmentCode: "75",
          },
          position: {
            lat: 48.8566,
            lon: 2.3522,
          },
        })
        .withUserRights([
          {
            email: "test@test.com",
            phone: "+33612345678",
            role: "establishment-admin",
            status: "ACCEPTED",
            shouldReceiveDiscussionNotifications: true,
            job: "test",
            isMainContactByPhone: false,
            isMainContactInPerson: true,
          },
        ])
        .build();

      expectToEqual(
        formEstablishmentSchema.parse(validFormEstablishment),
        validFormEstablishment,
      );
    });
  });
});

describe("establishmentFormOfferSchema", () => {
  const offer: EstablishmentFormOffer = {
    appellationCode: "11573",
    appellationLabel: "Boulanger / Boulangère",
    romeCode: "D1102",
    romeLabel: "Boulangerie - viennoiserie",
    remoteWorkMode: "ON_SITE",
  };

  it("accepts an offer without immersion activities", () => {
    expectToEqual(establishmentFormOfferSchema.parse(offer), offer);
  });

  it("accepts and trims multiline immersion activities", () => {
    expectToEqual(
      establishmentFormOfferSchema.parse({
        ...offer,
        immersionActivities:
          "  Préparer les pâtes\nCuire les pains au four à sole  ",
      }),
      {
        ...offer,
        immersionActivities:
          "Préparer les pâtes\nCuire les pains au four à sole",
      },
    );
  });

  it("accepts empty immersion activities", () => {
    expectToEqual(
      establishmentFormOfferSchema.parse({ ...offer, immersionActivities: "" }),
      { ...offer, immersionActivities: "" },
    );
  });

  it("rejects immersion activities longer than 1024 characters", () => {
    expect(
      establishmentFormOfferSchema.safeParse({
        ...offer,
        immersionActivities: "a".repeat(1025),
      }).success,
    ).toBe(false);
  });

  it("rejects immersion activities containing html", () => {
    expect(
      establishmentFormOfferSchema.safeParse({
        ...offer,
        immersionActivities: "<script>alert('xss')</script>",
      }).success,
    ).toBe(false);
  });
});
