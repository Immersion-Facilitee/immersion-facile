import {
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDomainJwtPayload,
  ConventionDtoBuilder,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeEmailHash } from "../../../utils/jwt";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import { makeSignAssessment } from "./SignAssessment";

const CONVENTION_ID = "a99eaca1-ee70-4c90-b3f4-668d492f7392";
const agency = new AgencyDtoBuilder().build();
const convention = new ConventionDtoBuilder()
  .withStatus("ACCEPTED_BY_VALIDATOR")
  .withId(CONVENTION_ID)
  .build();
const assessmentEntity: AssessmentEntity = {
  _entityName: "Assessment",
  ...new AssessmentDtoBuilder().withConventionId(convention.id).build(),
  numberOfHoursActuallyMade: 40,
};
const beneficiaryJwtPayload: ConventionDomainJwtPayload = {
  applicationId: convention.id,
  role: "beneficiary",
  emailHash: makeEmailHash(convention.signatories.beneficiary.email),
};
const beneficiary = new ConnectedUserBuilder()
  .withId("beneficiary")
  .withEmail(convention.signatories.beneficiary.email)
  .buildUser();
const userWithNoRightOnConvention = new ConnectedUserBuilder()
  .withId("user-with-no-right-on-convention")
  .withEmail("user-with-no-right-on-convention@mail.com")
  .buildUser();

const expectedSignedAt = new Date("2026-02-23");

describe("SignAssessment", () => {
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let signAssessment: ReturnType<typeof makeSignAssessment>;

  beforeEach(() => {
    uow = createInMemoryUow();
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    uow.conventionRepository.setConventions([convention]);
    uow.assessmentRepository.assessments = [assessmentEntity];
    uow.userRepository.users = [beneficiary, userWithNoRightOnConvention];
    timeGateway = new CustomTimeGateway();
    const createNewEvent = makeCreateNewEvent({
      timeGateway,
      uuidGenerator: new TestUuidGenerator(),
    });
    signAssessment = makeSignAssessment({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent,
        timeGateway,
      },
    });
  });

  describe("wrong paths", () => {
    describe("with convention jwt", () => {
      it("throws when user is not beneficiary", async () => {
        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: convention.id,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            {
              ...beneficiaryJwtPayload,
              role: "establishment-tutor",
            },
          ),
          errors.assessment.signForbidden(),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });

      it("throws when convention not found", async () => {
        const unknownConventionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        const uow = createInMemoryUow();
        uow.assessmentRepository.assessments = [assessmentEntity];
        const timeGateway = new CustomTimeGateway();
        const createNewEvent = makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new TestUuidGenerator(),
        });
        const signAssessment = makeSignAssessment({
          uowPerformer: new InMemoryUowPerformer(uow),
          deps: { createNewEvent, timeGateway },
        });
        const jwtPayload: ConventionDomainJwtPayload = {
          applicationId: unknownConventionId,
          role: "beneficiary",
          emailHash: makeEmailHash("beneficiary@email.fr"),
        };

        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: unknownConventionId,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            jwtPayload,
          ),
          errors.convention.notFound({
            conventionId: unknownConventionId,
          }),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });

      it("throws when assessment not found", async () => {
        uow.assessmentRepository.assessments = [];

        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: convention.id,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            beneficiaryJwtPayload,
          ),
          errors.assessment.notFound(CONVENTION_ID),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });

      it("throws when assessment is legacy (FINISHED/ABANDONED)", async () => {
        const legacyAssessment: AssessmentEntity = {
          _entityName: "Assessment",
          conventionId: convention.id,
          status: "FINISHED",
          establishmentFeedback: "Legacy feedback",
          numberOfHoursActuallyMade: null,
          createdAt: new Date("2023-03-11").toISOString(),
        };
        uow.assessmentRepository.assessments = [legacyAssessment];

        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: convention.id,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            beneficiaryJwtPayload,
          ),
          errors.assessment.signNotAvailableForLegacyAssessment(),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });

      it("throws when assessment already signed", async () => {
        const signedAssessment: AssessmentEntity = {
          _entityName: "Assessment",
          ...new AssessmentDtoBuilder()
            .withConventionId(convention.id)
            .withBeneficiarySignature({
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
              signedAt: "2024-01-01T00:00:00Z",
            })
            .build(),
          numberOfHoursActuallyMade: 40,
        };
        uow.assessmentRepository.assessments = [signedAssessment];

        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: convention.id,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            beneficiaryJwtPayload,
          ),
          errors.assessment.alreadySigned(CONVENTION_ID),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });
    });

    describe("with connected user jwt", () => {
      it("throws when connected user email is not linked to the convention", async () => {
        await expectPromiseToFailWithError(
          signAssessment.execute(
            {
              conventionId: convention.id,
              beneficiaryAgreement: true,
              beneficiaryFeedback: null,
            },
            { userId: userWithNoRightOnConvention.id },
          ),
          errors.assessment.signForbidden(),
        );
        expectObjectInArrayToMatch(uow.outboxRepository.events, []);
      });
    });
  });

  describe("happy paths", () => {
    describe("with convention jwt", () => {
      it("succeeds when beneficiary signs with agreement and comment", async () => {
        timeGateway.setNextDate(expectedSignedAt);

        await signAssessment.execute(
          {
            conventionId: convention.id,
            beneficiaryAgreement: true,
            beneficiaryFeedback: "Mon commentaire",
          },
          beneficiaryJwtPayload,
        );

        const signedAssessmentEntity =
          await uow.assessmentRepository.getByConventionId(convention.id);

        expectToEqual(signedAssessmentEntity, {
          ...assessmentEntity,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "Mon commentaire",
          signedAt: expectedSignedAt.toISOString(),
        });
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "AssessmentSignedByBeneficiary",
            payload: {
              conventionId: convention.id,
              assessment: expect.objectContaining({
                conventionId: convention.id,
                beneficiaryAgreement: true,
                beneficiaryFeedback: "Mon commentaire",
                signedAt: expectedSignedAt.toISOString(),
              }),
              triggeredBy: {
                kind: "convention-magic-link",
                role: "beneficiary",
              },
            },
          },
        ]);
      });

      it("succeeds when beneficiary signs with agreement and no comment", async () => {
        timeGateway.setNextDate(expectedSignedAt);

        await signAssessment.execute(
          {
            conventionId: convention.id,
            beneficiaryAgreement: true,
            beneficiaryFeedback: null,
          },
          beneficiaryJwtPayload,
        );

        const signedAssessmentEntity = (
          await uow.assessmentRepository.getByConventionIds([convention.id])
        ).at(0);

        expectToEqual(signedAssessmentEntity, {
          ...assessmentEntity,
          beneficiaryAgreement: true,
          beneficiaryFeedback: null,
          signedAt: expectedSignedAt.toISOString(),
        });
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "AssessmentSignedByBeneficiary",
            payload: {
              conventionId: convention.id,
              assessment: expect.objectContaining({
                conventionId: convention.id,
                beneficiaryAgreement: true,
                beneficiaryFeedback: null,
                signedAt: expectedSignedAt.toISOString(),
              }),
              triggeredBy: {
                kind: "convention-magic-link",
                role: "beneficiary",
              },
            },
          },
        ]);
      });

      it("succeeds when beneficiary disagrees with comment", async () => {
        timeGateway.setNextDate(expectedSignedAt);

        await signAssessment.execute(
          {
            conventionId: convention.id,
            beneficiaryAgreement: false,
            beneficiaryFeedback: "Je ne suis pas d'accord",
          },
          beneficiaryJwtPayload,
        );

        const signedAssessmentEntity = (
          await uow.assessmentRepository.getByConventionIds([convention.id])
        ).at(0);

        expectToEqual(signedAssessmentEntity, {
          ...assessmentEntity,
          beneficiaryAgreement: false,
          beneficiaryFeedback: "Je ne suis pas d'accord",
          signedAt: expectedSignedAt.toISOString(),
        });
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "AssessmentSignedByBeneficiary",
            payload: {
              conventionId: convention.id,
              assessment: expect.objectContaining({
                conventionId: convention.id,
                beneficiaryAgreement: false,
                beneficiaryFeedback: "Je ne suis pas d'accord",
                signedAt: expectedSignedAt.toISOString(),
              }),
              triggeredBy: {
                kind: "convention-magic-link",
                role: "beneficiary",
              },
            },
          },
        ]);
      });
    });

    describe("with connected user jwt", () => {
      it("succeeds when connected beneficiary signs", async () => {
        timeGateway.setNextDate(expectedSignedAt);

        await signAssessment.execute(
          {
            conventionId: convention.id,
            beneficiaryAgreement: true,
            beneficiaryFeedback: "Mon commentaire",
          },
          { userId: beneficiary.id },
        );

        const signedAssessmentEntity =
          await uow.assessmentRepository.getByConventionId(convention.id);

        expectToEqual(signedAssessmentEntity, {
          ...assessmentEntity,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "Mon commentaire",
          signedAt: expectedSignedAt.toISOString(),
        });
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "AssessmentSignedByBeneficiary",
            payload: {
              conventionId: convention.id,
              assessment: expect.objectContaining({
                conventionId: convention.id,
                beneficiaryAgreement: true,
                beneficiaryFeedback: "Mon commentaire",
                signedAt: expectedSignedAt.toISOString(),
              }),
              triggeredBy: { kind: "connected-user", userId: beneficiary.id },
            },
          },
        ]);
      });
    });
  });
});
