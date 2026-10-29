import {
  type ConventionDto,
  ConventionDtoBuilder,
  currentJwtVersions,
  errors,
  expectPromiseToFailWithError,
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
            email: "b**********@email.fr",
            phone: "+33*******78",
          },
        },
        {
          role: "establishment-representative" as const,
          email: "patron@email.com",
          expectedMaskedRecipients: {
            email: "p*****@email.com",
            phone: "+33*******89",
          },
        },
        {
          role: "establishment-tutor" as const,
          email: "tuteur@email.com",
          expectedMaskedRecipients: {
            email: "t*****@email.com",
            phone: "+33*******91",
          },
        },
        {
          role: "beneficiary-representative" as const,
          email: "parent@email.com",
          expectedMaskedRecipients: {
            email: "p*****@email.com",
            phone: "+33*******12",
          },
        },
        {
          role: "beneficiary-current-employer" as const,
          email: "employeur@email.com",
          expectedMaskedRecipients: {
            email: "e********@email.com",
            phone: "+33*******23",
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

          expect(maskedRecipients).toEqual(expectedMaskedRecipients);
        },
      );
    });
  });
});
