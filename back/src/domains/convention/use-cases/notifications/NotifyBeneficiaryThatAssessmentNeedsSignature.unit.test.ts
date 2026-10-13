import {
  AgencyDtoBuilder,
  type AssessmentCreator,
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
import { toAgencyWithRights } from "../../../../utils/agency";
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
const agency = new AgencyDtoBuilder().withId(convention.agencyId).build();

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
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

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
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
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

  it("notifies beneficiary without createdBy when missing", async () => {
    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    uow.assessmentRepository.assessments = [
      {
        _entityName: "Assessment",
        ...assessment,
        numberOfHoursActuallyMade: null,
      },
    ];

    await usecase.execute({ convention, assessment });

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
            assessmentSignatureLink: makeRouteAbsoluteUrl({
              route: frontRoutes.assessmentDocument({
                conventionId: convention.id,
                loginPersona: "beneficiary",
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
          },
          recipients: [convention.signatories.beneficiary.email],
        },
      ],
    });
  });

  it("notifies beneficiary with createdBy when present", async () => {
    const counsellorAgency = new AgencyDtoBuilder()
      .withId(convention.agencyId)
      .withName("Mission Locale")
      .build();
    const createdBy: AssessmentCreator = {
      role: "counsellor",
      email: "marie@agence.fr",
      firstName: "Marie",
      lastName: "Dupont",
    };
    const assessmentWithCreator: AssessmentDto = {
      ...assessment,
      createdBy,
    };
    uow.conventionRepository.setConventions([convention]);
    uow.agencyRepository.agencies = [toAgencyWithRights(counsellorAgency)];
    uow.assessmentRepository.assessments = [
      {
        _entityName: "Assessment",
        ...assessmentWithCreator,
        numberOfHoursActuallyMade: null,
      },
    ];

    await usecase.execute({ convention, assessment: assessmentWithCreator });

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
            assessmentSignatureLink: makeRouteAbsoluteUrl({
              route: frontRoutes.assessmentDocument({
                conventionId: convention.id,
                loginPersona: "beneficiary",
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
            createdBy: {
              ...createdBy,
              organizationName: "Mission Locale",
            },
          },
          recipients: [convention.signatories.beneficiary.email],
        },
      ],
    });
  });
});
