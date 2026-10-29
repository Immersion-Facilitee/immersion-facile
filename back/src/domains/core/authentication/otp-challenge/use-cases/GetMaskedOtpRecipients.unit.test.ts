import {
  type ConventionDto,
  ConventionDtoBuilder,
  currentJwtVersions,
  errors,
  expectPromiseToFailWithError,
  type VisitorOtpJwtPayload,
} from "shared";
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
    describe("Wrong path", () => {
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

      it("should throw if the convention does not exist", async () => {
        const visitorOtpJwtPayloadWithNonExistingConvention: VisitorOtpJwtPayload =
          {
            ...visitorOtpJwtPayload,
            subject: {
              ...visitorOtpJwtPayload.subject,
              conventionId: "nonExistingConventionId",
            },
          };

        expectPromiseToFailWithError(
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
      it("should throw if the required role is not present in the convention", async () => {
        const conventionWithoutCurrentEmployer: ConventionDto =
          new ConventionDtoBuilder().build();

        uow.conventionRepository.setConventions([
          conventionWithoutCurrentEmployer,
        ]);

        const visitorOtpJwtPayloadWithMissingRole: VisitorOtpJwtPayload = {
          ...visitorOtpJwtPayload,
          subject: {
            conventionId: conventionWithoutCurrentEmployer.id,
            role: "beneficiary-current-employer",
            emailHash: "someEmailHash",
          },
        };

        expectPromiseToFailWithError(
          getMaskedOtpRecipients.execute(
            undefined,
            visitorOtpJwtPayloadWithMissingRole,
          ),
          errors.convention.missingActor({
            conventionId:
              visitorOtpJwtPayloadWithMissingRole.subject.conventionId,
            role: visitorOtpJwtPayloadWithMissingRole.subject.role,
          }),
        );
      });
      it("should throw if the emailHash does not match the mail with the given role in the convention", async () => {});
    });
  });

  describe("Right path", () => {});
});
