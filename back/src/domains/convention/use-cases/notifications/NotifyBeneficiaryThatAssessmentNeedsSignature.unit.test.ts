import {
  type AssessmentDto,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
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
  makeNotifyBeneficiaryThatAssessmentNeedsSignature,
  type NotifyBeneficiaryThatAssessmentNeedsSignature,
} from "./NotifyBeneficiaryThatAssessmentNeedsSignature";

const convention = new ConventionDtoBuilder().build();

const assessment: AssessmentDto = {
  conventionId: convention.id,
  status: "COMPLETED",
  endedWithAJob: false,
  establishmentFeedback: "Feedback",
  establishmentAdvices: "Advices",
  beneficiaryAgreement: true,
  beneficiaryFeedback: null,
  signedAt: null,
  createdAt: new Date().toISOString(),
};

describe("NotifyBeneficiaryThatAssessmentNeedsSignature", () => {
  let uow: InMemoryUnitOfWork;
  let usecase: NotifyBeneficiaryThatAssessmentNeedsSignature;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let config: AppConfig;

  beforeEach(() => {
    uow = createInMemoryUow();
    config = new AppConfigBuilder({}).build();
    usecase = makeNotifyBeneficiaryThatAssessmentNeedsSignature({
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

  it("throws when convention not found", async () => {
    await expectPromiseToFailWithError(
      usecase.execute({ convention, assessment }),
      errors.convention.notFound({ conventionId: convention.id }),
    );
    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("throws when assessment not found", async () => {
    uow.conventionRepository.setConventions([convention]);
    uow.assessmentRepository.assessments = [];

    await expectPromiseToFailWithError(
      usecase.execute({ convention, assessment }),
      errors.assessment.notFound(convention.id),
    );
    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("does not send notification when assessment status is DID_NOT_SHOW", async () => {
    const assessmentDidNotShow: AssessmentDto = {
      ...assessment,
      status: "DID_NOT_SHOW",
    };
    uow.conventionRepository.setConventions([convention]);
    uow.assessmentRepository.assessments = [
      {
        _entityName: "Assessment",
        ...assessmentDidNotShow,
        numberOfHoursActuallyMade: null,
      },
    ];

    await usecase.execute({ convention, assessment: assessmentDidNotShow });

    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("notify beneficiary that assessment needs signature with connected assessment document URL", async () => {
    uow.conventionRepository.setConventions([convention]);
    uow.assessmentRepository.assessments = [
      {
        _entityName: "Assessment",
        ...assessment,
        numberOfHoursActuallyMade: null,
      },
    ];

    await usecase.execute({ convention, assessment });

    const assessmentSignatureLink = makeRouteAbsoluteUrl({
      route: frontRoutes.assessmentDocument({
        conventionId: convention.id,
        loginPersona: "beneficiary",
      }),
      baseUrl: config.immersionFacileBaseUrl,
    });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          params: {
            conventionId: convention.id,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            internshipKind: convention.internshipKind,
            assessmentSignatureLink,
          },
          recipients: [convention.signatories.beneficiary.email],
        },
      ],
    });
  });
});
