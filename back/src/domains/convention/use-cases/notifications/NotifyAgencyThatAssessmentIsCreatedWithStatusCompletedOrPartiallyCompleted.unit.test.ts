import {
  AgencyDtoBuilder,
  type AssessmentDto,
  type AssessmentStatus,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type ExtractFromExisting,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  reasonableSchedule,
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
import { createAssessmentEntity } from "../../entities/AssessmentEntity";
import {
  makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted,
  type NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted,
} from "./NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted";

const agency = new AgencyDtoBuilder().build();
const validator = new ConnectedUserBuilder()
  .withEmail("validator@email.com")
  .withId("validator")
  .buildUser();
const convention = new ConventionDtoBuilder()
  .withAgencyId(agency.id)
  .withDateStart(new Date("2025-01-01").toISOString())
  .withDateEnd(new Date("2025-01-03").toISOString())
  .withSchedule(reasonableSchedule)
  .withStatus("ACCEPTED_BY_VALIDATOR")
  .build();

const signedAssessment: Extract<
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

describe("NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted", () => {
  let uow: InMemoryUnitOfWork;
  let notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted: NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;
  let config: AppConfig;

  beforeEach(() => {
    uow = createInMemoryUow();

    timeGateway = new CustomTimeGateway();
    config = new AppConfigBuilder().build();
    notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted =
      makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted(
        {
          uowPerformer: new InMemoryUowPerformer(uow),
          deps: {
            saveNotificationAndRelatedEvent:
              makeSaveNotificationAndRelatedEvent(
                new UuidV4Generator(),
                timeGateway,
              ),
            config,
          },
        },
      );
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  it("Throw when no convention were found", async () => {
    await expectPromiseToFailWithError(
      notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
        { assessment: signedAssessment },
      ),
      errors.convention.notFound({
        conventionId: signedAssessment.conventionId,
      }),
    );

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });

  it("Throw when no agency were found", async () => {
    await uow.conventionRepository.save(convention);

    await expectPromiseToFailWithError(
      notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
        { assessment: signedAssessment },
      ),
      errors.agency.notFound({ agencyId: convention.agencyId }),
    );

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });

  it("Send an email to validators when beneficiary did the immersion and signed the assessment", async () => {
    const validator2 = new ConnectedUserBuilder()
      .withEmail("validator2@email.com")
      .withId("validator2")
      .buildUser();
    uow.userRepository.users = [validator, validator2];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: {
          isNotifiedByEmail: true,
          roles: ["validator", "counsellor"],
        },
        [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];

    await uow.conventionRepository.save(convention);
    await uow.assessmentRepository.save(
      createAssessmentEntity(signedAssessment, convention),
    );

    await notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
      { assessment: signedAssessment },
    );

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION",
          params: {
            agencyReferentName: getFormattedFirstnameAndLastname(
              convention.agencyReferent ?? {},
            ),
            immersionObjective: convention.immersionObjective,
            conventionId: convention.id,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            internshipKind: convention.internshipKind,
            conventionDateEnd: convention.dateEnd,
            immersionAppellationLabel:
              convention.immersionAppellation.appellationLabel,
            assessment: signedAssessment,
            numberOfHoursMade: "17h",
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: convention.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
          },
          recipients: [validator.email],
        },
        {
          kind: "ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION",
          params: {
            agencyReferentName: getFormattedFirstnameAndLastname(
              convention.agencyReferent ?? {},
            ),
            immersionObjective: convention.immersionObjective,
            conventionId: convention.id,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            businessName: convention.businessName,
            internshipKind: convention.internshipKind,
            conventionDateEnd: convention.dateEnd,
            immersionAppellationLabel:
              convention.immersionAppellation.appellationLabel,
            assessment: signedAssessment,
            numberOfHoursMade: "17h",
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: convention.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
          },
          recipients: [validator2.email],
        },
      ],
    });
  });

  it("Do not send an email when assessment is not signed", async () => {
    uow.userRepository.users = [validator];
    await uow.conventionRepository.save(convention);
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];

    const assessmentNotSigned: AssessmentDto = {
      ...signedAssessment,
      signedAt: null,
      beneficiaryAgreement: null,
    };
    await notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
      { assessment: assessmentNotSigned },
    );
    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });

  it("Do not send an email when assessment status is DID_NOT_SHOW", async () => {
    uow.userRepository.users = [validator];
    await uow.conventionRepository.save(convention);
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    ];
    const assessmentDidNotShow: AssessmentDto = {
      conventionId: convention.id,
      status: "DID_NOT_SHOW",
      endedWithAJob: false,
      establishmentFeedback: "feedback",
      establishmentAdvices: "conseil",
      beneficiaryAgreement: true,
      beneficiaryFeedback: "my super feedback",
      signedAt: new Date("2025-01-01").toISOString(),
      createdAt: new Date("2025-01-01").toISOString(),
    };

    await notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
      { assessment: assessmentDidNotShow },
    );

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });

  describe("When the convention is FT connected", () => {
    const advisorEmail = "john.doe@mail.fr";

    beforeEach(() => {
      uow.conventionFranceTravailAdvisorRepository.saveFtUserAndAdvisor({
        user: {
          ftExternalId: "pe-external-id",
          email: advisorEmail,
          firstName: "Elsa",
          isJobseeker: true,
          lastName: "Oldenburg",
          birthdate: "1990-01-01",
        },
        advisor: {
          firstName: "John",
          lastName: "Doe",
          type: "PLACEMENT",
          email: advisorEmail,
        },
      });
      uow.conventionFranceTravailAdvisorRepository.associateConventionAndUserAdvisor(
        convention.id,
        "pe-external-id",
      );
    });

    it("When beneficiary did the immersion, send an email to the advisor (and not to other agency users)", async () => {
      uow.userRepository.users = [validator];
      uow.agencyRepository.agencies = [
        toAgencyWithRights(agency, {
          [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        }),
      ];

      await uow.conventionRepository.save(convention);
      await uow.assessmentRepository.save(
        createAssessmentEntity(signedAssessment, convention),
      );

      await notifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted.execute(
        { assessment: signedAssessment },
      );

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION",
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                convention.agencyReferent ?? {},
              ),
              immersionObjective: convention.immersionObjective,
              conventionId: convention.id,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              internshipKind: convention.internshipKind,
              conventionDateEnd: convention.dateEnd,
              immersionAppellationLabel:
                convention.immersionAppellation.appellationLabel,
              assessment: signedAssessment,
              numberOfHoursMade: "17h",
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: convention.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
            },
            recipients: [advisorEmail],
          },
        ],
      });
    });
  });
});
