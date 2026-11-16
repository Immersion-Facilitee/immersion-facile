import {
  type ConventionDto,
  ConventionDtoBuilder,
  currentJwtVersions,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type VisitorOtpJwtPayload,
} from "shared";
import { makeEmailHash } from "../../../../../utils/jwt";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import {
  type GetMaskedOtpRecipients,
  makeGetMaskedOtpRecipients,
} from "./GetMaskedOtpRecipients";

describe("GetMaskedOtpRecipients", () => {
  let uow: InMemoryUnitOfWork;
  let getMaskedOtpRecipients: GetMaskedOtpRecipients;

  beforeEach(() => {
    uow = createInMemoryUow();

    getMaskedOtpRecipients = makeGetMaskedOtpRecipients({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("manageConvention purpose", () => {
    const visitorOtpJwtPayload: VisitorOtpJwtPayload = {
      purpose: "manageConvention",
      subject: {
        conventionId: "someConventionId",
        role: "beneficiary",
        emailHash: "someEmailHash",
      },
      version: currentJwtVersions.visitorOtp,
      iat: Date.now(),
      exp: Date.now() + 60 * 60,
    };

    describe("Wrong path", () => {
      it("should throw if the convention does not exist", async () => {
        const visitorOtpJwtPayloadWithNonExistingConvention: VisitorOtpJwtPayload =
          {
            ...visitorOtpJwtPayload,
            subject: {
              ...visitorOtpJwtPayload.subject,
              conventionId: "nonExistingConventionId",
            },
          };

        await expectPromiseToFailWithError(
          getMaskedOtpRecipients.execute(
            undefined,
            visitorOtpJwtPayloadWithNonExistingConvention,
          ),
          errors.convention.notFound({
            conventionId:
              visitorOtpJwtPayloadWithNonExistingConvention.subject
                .conventionId,
          }),
        );
      });

      it.each([
        { role: "beneficiary-current-employer" as const },
        { role: "beneficiary-representative" as const },
      ])(
        "should throw if the role $role is not present in the convention",
        async ({ role }) => {
          const conventionWithoutOptionalSignatories: ConventionDto =
            new ConventionDtoBuilder().build();

          uow.conventionRepository.setConventions([
            conventionWithoutOptionalSignatories,
          ]);

          const visitorOtpJwtPayloadWithMissingRole: VisitorOtpJwtPayload = {
            ...visitorOtpJwtPayload,
            subject: {
              conventionId: conventionWithoutOptionalSignatories.id,
              role,
              emailHash: "someEmailHash",
            },
          };

          await expectPromiseToFailWithError(
            getMaskedOtpRecipients.execute(
              undefined,
              visitorOtpJwtPayloadWithMissingRole,
            ),
            errors.convention.missingActor({
              conventionId: conventionWithoutOptionalSignatories.id,
              role,
            }),
          );
        },
      );

      it("should throw if the emailHash does not match the mail with the given role in the convention", async () => {
        const convention: ConventionDto = new ConventionDtoBuilder().build();

        uow.conventionRepository.setConventions([convention]);

        const visitorOtpJwtPayloadWithOtherActorEmailHash: VisitorOtpJwtPayload =
          {
            ...visitorOtpJwtPayload,
            subject: {
              conventionId: convention.id,
              role: "beneficiary",
              emailHash: makeEmailHash(
                convention.signatories.establishmentRepresentative.email,
              ),
            },
          };

        await expectPromiseToFailWithError(
          getMaskedOtpRecipients.execute(
            undefined,
            visitorOtpJwtPayloadWithOtherActorEmailHash,
          ),
          errors.convention.forbiddenMissingRightsEmailHash({
            conventionId: convention.id,
            role: "beneficiary",
            emailHash: makeEmailHash(
              convention.signatories.establishmentRepresentative.email,
            ),
          }),
        );
      });
    });

    describe("Right path", () => {
      const convention: ConventionDto = new ConventionDtoBuilder()
        .withBeneficiaryEmail("beneficiary@email.fr")
        .withBeneficiaryPhone("+33612345678")
        .withEstablishmentRepresentativeEmail("patron@email.com")
        .withEstablishmentRepresentativePhone("+33623456789")
        .withEstablishmentTutorEmail("tuteur@email.com")
        .withEstablishmentTutorPhone("+33634567891")
        .withBeneficiaryRepresentative({
          role: "beneficiary-representative",
          email: "parent@email.com",
          phone: "+33645678912",
          firstName: "Bob",
          lastName: "L'éponge",
        })
        .withBeneficiaryCurrentEmployer({
          role: "beneficiary-current-employer",
          email: "employeur@email.com",
          phone: "+33656789123",
          firstName: "Jean",
          lastName: "Employeur",
          job: "Boss",
          businessSiret: "01234567891234",
          businessName: "business",
          businessAddress: "Rue des Bouchers 67065 Strasbourg",
        })
        .build();

      it.each([
        {
          role: "beneficiary" as const,
          email: "beneficiary@email.fr",
          expectedMaskedRecipients: {
            maskedEmail: "b*********y@email.fr",
            maskedPhone: "06******78",
          },
        },
        {
          role: "establishment-representative" as const,
          email: "patron@email.com",
          expectedMaskedRecipients: {
            maskedEmail: "p****n@email.com",
            maskedPhone: "06******89",
          },
        },
        {
          role: "establishment-tutor" as const,
          email: "tuteur@email.com",
          expectedMaskedRecipients: {
            maskedEmail: "t****r@email.com",
            maskedPhone: "06******91",
          },
        },
        {
          role: "beneficiary-representative" as const,
          email: "parent@email.com",
          expectedMaskedRecipients: {
            maskedEmail: "p****t@email.com",
            maskedPhone: "06******12",
          },
        },
        {
          role: "beneficiary-current-employer" as const,
          email: "employeur@email.com",
          expectedMaskedRecipients: {
            maskedEmail: "e*******r@email.com",
            maskedPhone: "06******23",
          },
        },
      ])(
        "should return the masked email and phone of the $role",
        async ({ role, email, expectedMaskedRecipients }) => {
          uow.conventionRepository.setConventions([convention]);

          const maskedRecipients = await getMaskedOtpRecipients.execute(
            undefined,
            {
              ...visitorOtpJwtPayload,
              subject: {
                conventionId: convention.id,
                role,
                emailHash: makeEmailHash(email),
              },
            },
          );

          expectToEqual(maskedRecipients, expectedMaskedRecipients);
        },
      );
    });

    it("should not return the phone if it is not a mobile phone number", async () => {
      const conventionWithLandlinePhone: ConventionDto =
        new ConventionDtoBuilder()
          .withBeneficiaryEmail("beneficiary@email.fr")
          .withBeneficiaryPhone("+33123456789")
          .build();

      uow.conventionRepository.setConventions([conventionWithLandlinePhone]);

      const maskedRecipients = await getMaskedOtpRecipients.execute(undefined, {
        ...visitorOtpJwtPayload,
        subject: {
          conventionId: conventionWithLandlinePhone.id,
          role: "beneficiary",
          emailHash: makeEmailHash(
            conventionWithLandlinePhone.signatories.beneficiary.email,
          ),
        },
      });

      expectToEqual(maskedRecipients, {
        maskedEmail: "b*********y@email.fr",
        maskedPhone: null,
      });
    });

    it.each([
      { email: "a@email.fr", expectedMaskedEmail: "*@email.fr" },
      { email: "ab@email.fr", expectedMaskedEmail: "a*@email.fr" },
      { email: "abc@email.fr", expectedMaskedEmail: "a*c@email.fr" },
    ])(
      "should mask the short local part of $email",
      async ({ email, expectedMaskedEmail }) => {
        const conventionWithShortBeneficiaryEmail: ConventionDto =
          new ConventionDtoBuilder()
            .withBeneficiaryEmail(email)
            .withBeneficiaryPhone("+33612345678")
            .build();

        uow.conventionRepository.setConventions([
          conventionWithShortBeneficiaryEmail,
        ]);

        const maskedRecipients = await getMaskedOtpRecipients.execute(
          undefined,
          {
            ...visitorOtpJwtPayload,
            subject: {
              conventionId: conventionWithShortBeneficiaryEmail.id,
              role: "beneficiary",
              emailHash: makeEmailHash(email),
            },
          },
        );

        expectToEqual(maskedRecipients, {
          maskedEmail: expectedMaskedEmail,
          maskedPhone: "06******78",
        });
      },
    );
  });
});
