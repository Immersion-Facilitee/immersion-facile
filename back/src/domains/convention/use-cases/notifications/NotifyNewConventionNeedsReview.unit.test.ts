import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type FtConnectIdentity,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
} from "shared";
import { v4 as uuid } from "uuid";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import type { FtConnectImmersionAdvisorDto } from "../../../core/authentication/ft-connect/dto/FtConnectAdvisor.dto";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyNewConventionNeedsReview,
  type NotifyNewConventionNeedsReview,
} from "./NotifyNewConventionNeedsReview";

describe("NotifyNewConventionNeedsReview", () => {
  const validator1 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("validator1@unmail.com")
    .buildUser();
  const validator2 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("validator2@unmail.com")
    .buildUser();
  const councellor1 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("aCouncellor@unmail.com")
    .build();
  const councellor2 = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail("anotherCouncellor@unmail.com")
    .build();

  const defaultConvention = new ConventionDtoBuilder().build();

  const agencyWithoutCouncellorsAndValidators = AgencyDtoBuilder.create(
    defaultConvention.agencyId,
  ).build();

  const agencyWithValidatorsOnly = toAgencyWithRights(
    agencyWithoutCouncellorsAndValidators,
    {
      [validator1.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );
  const agencyWithCounsellorsAndValidators = toAgencyWithRights(
    agencyWithoutCouncellorsAndValidators,
    {
      [councellor1.id]: { isNotifiedByEmail: false, roles: ["counsellor"] },
      [councellor2.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      [validator1.id]: { isNotifiedByEmail: false, roles: ["validator"] },
      [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
    },
  );

  const ftAdvisorEmail = "ft-advisor@gmail.com";
  const advisor: FtConnectImmersionAdvisorDto = {
    email: ftAdvisorEmail,
    firstName: "Elsa",
    lastName: "Oldenburg",
    type: "CAPEMPLOI",
  };
  const ftIdentity: FtConnectIdentity = {
    provider: "ftConnect",
    token: "123",
    payload: {
      advisor,
    },
  };

  let uow: InMemoryUnitOfWork;
  let notifyNewConventionNeedsReview: NotifyNewConventionNeedsReview;
  let config: AppConfig;
  let conventionInReview: ConventionDto;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  const timeGateway = new CustomTimeGateway();

  beforeEach(() => {
    config = new AppConfigBuilder().build();
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    notifyNewConventionNeedsReview = makeNotifyNewConventionNeedsReview({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
        config,
      },
    });
    uow.userRepository.users = [
      councellor1,
      councellor2,
      validator1,
      validator2,
    ];
  });

  describe("When convention status is IN_REVIEW", () => {
    beforeEach(() => {
      conventionInReview = new ConventionDtoBuilder(defaultConvention)
        .withStatus("IN_REVIEW")
        .build();
    });

    it("Nominal case: Sends notification email to councellor, with 2 existing councellors", async () => {
      uow.agencyRepository.agencies = [agencyWithCounsellorsAndValidators];

      await notifyNewConventionNeedsReview.execute({
        convention: conventionInReview,
      });
      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [councellor2.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionInReview.agencyReferent ?? {},
              ),
              conventionId: conventionInReview.id,
              internshipKind: conventionInReview.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: conventionInReview.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: conventionInReview.signatories.beneficiary.lastName,
              }),
              businessName: conventionInReview.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionInReview.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en vérifier l'éligibilité",
              agencyLogoUrl:
                agencyWithoutCouncellorsAndValidators.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
        ],
      });
    });

    it("No counsellors available: we fall back to validators: Sends notification email to those validators (using 2 of them)", async () => {
      uow.agencyRepository.agencies = [agencyWithValidatorsOnly];

      await notifyNewConventionNeedsReview.execute({
        convention: conventionInReview,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [validator1.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionInReview.agencyReferent ?? {},
              ),
              conventionId: conventionInReview.id,
              internshipKind: conventionInReview.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: conventionInReview.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: conventionInReview.signatories.beneficiary.lastName,
              }),
              businessName: conventionInReview.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionInReview.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl:
                agencyWithoutCouncellorsAndValidators.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [validator2.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionInReview.agencyReferent ?? {},
              ),
              conventionId: conventionInReview.id,
              internshipKind: conventionInReview.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: conventionInReview.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: conventionInReview.signatories.beneficiary.lastName,
              }),
              businessName: conventionInReview.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionInReview.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl:
                agencyWithoutCouncellorsAndValidators.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
        ],
      });
    });

    it("No counsellors available, neither validators => ensure no mail is sent", async () => {
      await notifyNewConventionNeedsReview.execute({
        convention: conventionInReview,
      });
      expectSavedNotificationsAndEvents({ emails: [] });
    });

    it("sends notification to counsellors (when they exist), even if there is a peAdvisor", async () => {
      uow.agencyRepository.agencies = [agencyWithCounsellorsAndValidators];

      const conventionInReviewWithFtAdvisor = new ConventionDtoBuilder(
        defaultConvention,
      )
        .withStatus("IN_REVIEW")
        .withFederatedIdentity(ftIdentity)
        .build();

      await notifyNewConventionNeedsReview.execute({
        convention: conventionInReviewWithFtAdvisor,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [councellor2.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionInReviewWithFtAdvisor.agencyReferent ?? {},
              ),
              conventionId: conventionInReviewWithFtAdvisor.id,
              internshipKind: conventionInReviewWithFtAdvisor.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  conventionInReviewWithFtAdvisor.signatories.beneficiary
                    .firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  conventionInReviewWithFtAdvisor.signatories.beneficiary
                    .lastName,
              }),
              businessName: conventionInReviewWithFtAdvisor.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionInReviewWithFtAdvisor.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en vérifier l'éligibilité",
              agencyLogoUrl:
                agencyWithCounsellorsAndValidators.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
        ],
      });
    });

    it("Sends notification email only to peAdvisor when beneficiary is ftConnected and beneficiary has PE advisor", async () => {
      uow.agencyRepository.agencies = [agencyWithValidatorsOnly];

      const conventionInReviewWithFtAdvisor = new ConventionDtoBuilder(
        defaultConvention,
      )
        .withStatus("IN_REVIEW")
        .withFederatedIdentity(ftIdentity)
        .build();

      const advisor: FtConnectImmersionAdvisorDto = {
        email: ftAdvisorEmail,
        firstName: "Elsa",
        lastName: "Oldenburg",
        type: "CAPEMPLOI",
      };

      await notifyNewConventionNeedsReview.execute({
        convention: conventionInReviewWithFtAdvisor,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [ftAdvisorEmail],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionInReviewWithFtAdvisor.agencyReferent ?? {},
              ),
              conventionId: conventionInReviewWithFtAdvisor.id,
              internshipKind: conventionInReviewWithFtAdvisor.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  conventionInReviewWithFtAdvisor.signatories.beneficiary
                    .firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  conventionInReviewWithFtAdvisor.signatories.beneficiary
                    .lastName,
              }),
              businessName: conventionInReviewWithFtAdvisor.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionInReviewWithFtAdvisor.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl: agencyWithValidatorsOnly.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: {
                recipientIsPeAdvisor: true,
                ...advisor,
              },
            },
          },
        ],
      });
    });
  });
  describe("When convention status is ACCEPTED_BY_COUNSELLOR", () => {
    let acceptedByCounsellorConvention: ConventionDto;
    beforeEach(() => {
      acceptedByCounsellorConvention = new ConventionDtoBuilder(
        defaultConvention,
      )
        .withStatus("ACCEPTED_BY_COUNSELLOR")
        .build();
    });

    it("Nominal case: Sends notification email to validators", async () => {
      uow.agencyRepository.agencies = [agencyWithValidatorsOnly];

      await notifyNewConventionNeedsReview.execute({
        convention: acceptedByCounsellorConvention,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [validator1.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                acceptedByCounsellorConvention.agencyReferent ?? {},
              ),
              conventionId: acceptedByCounsellorConvention.id,
              internshipKind: acceptedByCounsellorConvention.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  acceptedByCounsellorConvention.signatories.beneficiary
                    .firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  acceptedByCounsellorConvention.signatories.beneficiary
                    .lastName,
              }),
              businessName: acceptedByCounsellorConvention.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: acceptedByCounsellorConvention.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl: agencyWithValidatorsOnly.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [validator2.email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                acceptedByCounsellorConvention.agencyReferent ?? {},
              ),
              conventionId: acceptedByCounsellorConvention.id,
              internshipKind: acceptedByCounsellorConvention.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  acceptedByCounsellorConvention.signatories.beneficiary
                    .firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  acceptedByCounsellorConvention.signatories.beneficiary
                    .lastName,
              }),
              businessName: acceptedByCounsellorConvention.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: acceptedByCounsellorConvention.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl: agencyWithValidatorsOnly.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: undefined,
            },
          },
        ],
      });
    });

    it("No validators available => ensure no mail is sent", async () => {
      await notifyNewConventionNeedsReview.execute({
        convention: acceptedByCounsellorConvention,
      });
      expectSavedNotificationsAndEvents({ emails: [] });
    });

    it("Sends notification email only to peAdvisor when beneficiary is ftConnected and beneficiary has PE advisor", async () => {
      uow.agencyRepository.agencies = [agencyWithValidatorsOnly];

      const conventionAcceptedByCounsellorWithFtAdvisor =
        new ConventionDtoBuilder(defaultConvention)
          .withStatus("ACCEPTED_BY_COUNSELLOR")
          .withFederatedIdentity(ftIdentity)
          .build();

      const advisor: FtConnectImmersionAdvisorDto = {
        email: ftAdvisorEmail,
        firstName: "Elsa",
        lastName: "Oldenburg",
        type: "CAPEMPLOI",
      };

      await notifyNewConventionNeedsReview.execute({
        convention: conventionAcceptedByCounsellorWithFtAdvisor,
      });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
            recipients: [ftAdvisorEmail],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                conventionAcceptedByCounsellorWithFtAdvisor.agencyReferent ??
                  {},
              ),
              conventionId: conventionAcceptedByCounsellorWithFtAdvisor.id,
              internshipKind:
                conventionAcceptedByCounsellorWithFtAdvisor.internshipKind,
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname:
                  conventionAcceptedByCounsellorWithFtAdvisor.signatories
                    .beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname:
                  conventionAcceptedByCounsellorWithFtAdvisor.signatories
                    .beneficiary.lastName,
              }),
              businessName:
                conventionAcceptedByCounsellorWithFtAdvisor.businessName,
              manageConventionLink: makeRouteAbsoluteUrl({
                route: frontRoutes.manageConventionConnectedUser({
                  conventionId: conventionAcceptedByCounsellorWithFtAdvisor.id,
                }),
                baseUrl: config.immersionFacileBaseUrl,
              }),
              possibleRoleAction: "en considérer la validation",
              agencyLogoUrl: agencyWithValidatorsOnly.logoUrl ?? undefined,
              validatorName: "",
              peAdvisor: {
                recipientIsPeAdvisor: true,
                ...advisor,
              },
            },
          },
        ],
      });
    });
  });
});
