import {
  type AssessmentDto,
  type AssessmentStatus,
  ConventionDtoBuilder,
  type ExtractFromExisting,
  emailTemplatesByName,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  reasonableSchedule,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyBeneficiaryThatAssessmentIsCreated,
  type NotifyBeneficiaryThatAssessmentIsCreated,
} from "./NotifyBeneficiaryThatAssessmentIsCreated";

const convention = new ConventionDtoBuilder().build();
const assessment: Extract<
  AssessmentDto,
  {
    status: ExtractFromExisting<AssessmentStatus, "PARTIALLY_COMPLETED">;
  }
> = {
  endedWithAJob: false,
  conventionId: convention.id,
  status: "PARTIALLY_COMPLETED",
  lastDayOfPresence: new Date("2025-01-07").toISOString(),
  numberOfMissedHours: 4,
  establishmentFeedback: "osef",
  establishmentAdvices: "osef",
  beneficiaryAgreement: true,
  beneficiaryFeedback: "my super feedback",
  signedAt: new Date("2025-01-01").toISOString(),
  createdAt: new Date("2025-01-01").toISOString(),
};

describe("NotifyBeneficiaryThatAssessmentIsCreated", () => {
  let uow: InMemoryUnitOfWork;
  let usecase: NotifyBeneficiaryThatAssessmentIsCreated;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let config: AppConfig;

  beforeEach(() => {
    uow = createInMemoryUow();
    config = new AppConfigBuilder({}).build();
    usecase = makeNotifyBeneficiaryThatAssessmentIsCreated({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          new CustomTimeGateway(),
        ),
        config,
      },
    });
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  describe("wrong paths", () => {
    it("Throw when no convention is found", async () => {
      await expectPromiseToFailWithError(
        usecase.execute({ assessment }),
        errors.convention.notFound({ conventionId: assessment.conventionId }),
      );

      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });
  });

  describe("right paths", () => {
    it("Send an email to beneficiary", async () => {
      uow.conventionRepository.setConventions([convention]);

      await usecase.execute({ assessment });

      const magicLink = makeRouteAbsoluteUrl({
        route: frontRoutes.assessmentDocument({
          conventionId: convention.id,
          loginPersona: "beneficiary",
        }),
        baseUrl: config.immersionFacileBaseUrl,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION",
            params: {
              internshipKind: convention.internshipKind,
              conventionId: convention.id,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              magicLink,
            },
            recipients: [convention.signatories.beneficiary.email],
          },
        ],
      });
    });

    it("Sends one email to the beneficiary and one to the legal representative for mini-stage CCI", async () => {
      const dateStart = new Date("2024-10-07").toISOString();
      const dateEnd = new Date("2024-10-11").toISOString();
      const cciConventionWithRepresentative = new ConventionDtoBuilder()
        .withInternshipKind("mini-stage-cci")
        .withDateStart(dateStart)
        .withDateEnd(dateEnd)
        .withSchedule(() =>
          reasonableSchedule({
            start: new Date(dateStart),
            end: new Date(dateEnd),
          }),
        )
        .withBeneficiaryRepresentative({
          role: "beneficiary-representative",
          firstName: "Legal",
          lastName: "Representative",
          phone: "+33601010102",
          email: "legal.rep@mail.fr",
        })
        .build();
      const miniStageAssessment: AssessmentDto = {
        ...assessment,
        conventionId: cciConventionWithRepresentative.id,
      };
      uow.conventionRepository.setConventions([
        cciConventionWithRepresentative,
      ]);

      await usecase.execute({ assessment: miniStageAssessment });

      const magicLink = makeRouteAbsoluteUrl({
        route: frontRoutes.assessmentDocument({
          conventionId: cciConventionWithRepresentative.id,
          loginPersona: "beneficiary",
        }),
        baseUrl: config.immersionFacileBaseUrl,
      });

      const emailParams = {
        internshipKind: cciConventionWithRepresentative.internshipKind,
        conventionId: cciConventionWithRepresentative.id,
        beneficiaryFirstName: getFormattedFirstnameAndLastname({
          firstname:
            cciConventionWithRepresentative.signatories.beneficiary.firstName,
        }),
        beneficiaryLastName: getFormattedFirstnameAndLastname({
          lastname:
            cciConventionWithRepresentative.signatories.beneficiary.lastName,
        }),
        magicLink,
      };

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION",
            params: emailParams,
            recipients: [
              cciConventionWithRepresentative.signatories.beneficiary.email,
            ],
          },
          {
            kind: "ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION",
            params: emailParams,
            recipients: [
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              cciConventionWithRepresentative.signatories
                .beneficiaryRepresentative!.email,
            ],
          },
        ],
      });
    });
  });
});
