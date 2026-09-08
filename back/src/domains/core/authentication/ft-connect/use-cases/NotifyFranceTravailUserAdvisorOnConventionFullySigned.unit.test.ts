import {
  type AgencyWithUsersRights,
  type ConventionDto,
  ConventionDtoBuilder,
  type FtConnectImmersionAdvisorDto,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  reasonableSchedule,
} from "shared";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../../utils/AppConfigBuilder";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyFranceTravailUserAdvisorOnConventionFullySigned,
  type NotifyFranceTravailUserAdvisorOnConventionFullySigned,
} from "./NotifyFranceTravailUserAdvisorOnConventionFullySigned";

describe("NotifyFranceTravailUserAdvisorOnConventionFullySigned", () => {
  const conventionId = "749dd14f-c82a-48b1-b1bb-fffc5467e4d4";
  const userFtExternalId = "749dd14f-c82a-48b1-b1bb-fffc5467e4d4";
  const advisor: FtConnectImmersionAdvisorDto = {
    email: "elsa.oldenburg@pole-emploi.net",
    firstName: "Elsa",
    lastName: "Oldenburg",
    type: "CAPEMPLOI",
  };

  let uow: InMemoryUnitOfWork;
  let notifyFranceTravailUserAdvisorOnConventionFullySigned: NotifyFranceTravailUserAdvisorOnConventionFullySigned;
  let agency: AgencyWithUsersRights;
  const timeGateway = new CustomTimeGateway();
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let config: AppConfig;

  beforeEach(() => {
    uow = createInMemoryUow();
    agency = uow.agencyRepository.agencies[0];
    config = new AppConfigBuilder().build();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    const uuidGenerator = new UuidV4Generator();
    const saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      uuidGenerator,
      timeGateway,
    );

    notifyFranceTravailUserAdvisorOnConventionFullySigned =
      makeNotifyFranceTravailUserAdvisorOnConventionFullySigned({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent,
          config,
        },
      });
  });

  it("should resolve to undefined if the convention France Travail OAuth advisor is not found", async () => {
    const conventionDtoFromEvent: ConventionDto = new ConventionDtoBuilder()
      .withId("add5c20e-6dd2-45af-affe-927358005251")
      .withFederatedIdentity({ provider: "ftConnect", token: "blop" })
      .build();

    expect(
      await notifyFranceTravailUserAdvisorOnConventionFullySigned.execute({
        convention: conventionDtoFromEvent,
      }),
    ).toBeUndefined();
  });

  it("should send email with the correct params", async () => {
    const conventionDtoFromEvent = new ConventionDtoBuilder()
      .withId(conventionId)
      .withAgencyId(agency.id)
      .withFederatedIdentity({ provider: "ftConnect", token: userFtExternalId })
      .withBeneficiaryFirstName("John")
      .withBeneficiaryLastName("Doe")
      .withBeneficiaryEmail("john.doe@plop.fr")
      .withImmersionAddress("127 Avenue de la République 94800 Villejuif")
      .withDateStart("2022-07-06")
      .withDateEnd("2022-07-30")
      .withSchedule((interval) =>
        reasonableSchedule(interval, ["samedi", "dimanche"]),
      )
      .withFederatedIdentity({
        provider: "ftConnect",
        token: userFtExternalId,
        payload: {
          advisor,
        },
      })
      .withBusinessName("Boulangerie Les Echarts")
      .build();

    uow.conventionRepository.setConventions([conventionDtoFromEvent]);

    await notifyFranceTravailUserAdvisorOnConventionFullySigned.execute({
      convention: conventionDtoFromEvent,
    });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "POLE_EMPLOI_ADVISOR_ON_CONVENTION_FULLY_SIGNED",
          recipients: [advisor.email],
          params: {
            conventionId,
            advisorFirstName: getFormattedFirstnameAndLastname({
              firstname: advisor.firstName,
            }),
            advisorLastName: getFormattedFirstnameAndLastname({
              lastname: advisor.lastName,
            }),
            immersionAddress: conventionDtoFromEvent.immersionAddress,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname:
                conventionDtoFromEvent.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: conventionDtoFromEvent.signatories.beneficiary.lastName,
            }),
            beneficiaryEmail:
              conventionDtoFromEvent.signatories.beneficiary.email,
            dateStart: conventionDtoFromEvent.dateStart,
            dateEnd: conventionDtoFromEvent.dateEnd,
            businessName: conventionDtoFromEvent.businessName,
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: conventionDtoFromEvent.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
            agencyLogoUrl: agency.logoUrl ?? undefined,
          },
        },
      ],
    });
  });

  it("ftConnected without advisor", async () => {
    const conventionDtoFromEvent = new ConventionDtoBuilder()
      .withId(conventionId)
      .withAgencyId(agency.id)
      .withFederatedIdentity({ provider: "ftConnect", token: userFtExternalId })
      .withBeneficiaryFirstName("John")
      .withBeneficiaryLastName("Doe")
      .withBeneficiaryEmail("john.doe@plop.fr")
      .withImmersionAddress("127 Avenue de la République 94800 Villejuif")
      .withDateStart("2022-07-06")
      .withDateEnd("2022-07-30")
      .withSchedule((interval) =>
        reasonableSchedule(interval, ["samedi", "dimanche"]),
      )
      .withFederatedIdentity({
        provider: "ftConnect",
        token: userFtExternalId,
      })
      .withBusinessName("Boulangerie Les Echarts")
      .build();

    uow.conventionRepository.setConventions([conventionDtoFromEvent]);

    await notifyFranceTravailUserAdvisorOnConventionFullySigned.execute({
      convention: conventionDtoFromEvent,
    });

    expectSavedNotificationsAndEvents({
      emails: [],
    });
  });
});
