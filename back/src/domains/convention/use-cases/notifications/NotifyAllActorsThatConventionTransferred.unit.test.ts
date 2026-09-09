import {
  AgencyDtoBuilder,
  ConnectedUserBuilder,
  type ConnectedUserDomainJwtPayload,
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
import type { TransferConventionToAgencyPayload } from "../../../core/events/eventPayload.dto";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyAllActorsThatConventionTransferred,
  type NotifyAllActorsThatConventionTransferred,
} from "./NotifyAllActorsThatConventionTransferred";

describe("NotifyAllActorsThatConventionTransferred", () => {
  const previousAgency = new AgencyDtoBuilder()
    .withId("previous-agency")
    .build();
  const newAgency = new AgencyDtoBuilder().withId("new-agency").build();
  const convention = new ConventionDtoBuilder()
    .withAgencyId(newAgency.id)
    .withEstablishmentTutor({
      email: "establishment-tutor@example.com",
      firstName: "Establishment",
      lastName: "Tutor",
      phone: "0606060606",
      role: "establishment-tutor",
      job: "Job",
    })
    .withEstablishmentRepresentative({
      email: "establishment-representative@example.com",
      firstName: "Establishment",
      lastName: "Representative",
      phone: "0606060606",
      role: "establishment-representative",
    })
    .build();
  const connectedUserPayload: ConnectedUserDomainJwtPayload = {
    userId: "bcc5c20e-6dd2-45cf-affe-927358005262",
  };

  const connectedUser = new ConnectedUserBuilder()
    .withId(connectedUserPayload.userId)
    .build();
  const config: AppConfig = new AppConfigBuilder()
    .withTestPresetPreviousKeys()
    .build();
  let uow: InMemoryUnitOfWork;
  let usecase: NotifyAllActorsThatConventionTransferred;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    usecase = makeNotifyAllActorsThatConventionTransferred({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          new CustomTimeGateway(),
        ),
        config,
      },
    });
  });

  it("throw if new agency not found", async () => {
    uow.agencyRepository.agencies = [toAgencyWithRights(previousAgency, {})];
    const input: TransferConventionToAgencyPayload = {
      agencyId: newAgency.id,
      convention,
      justification: "agency change",
      previousAgencyId: previousAgency.id,
      shouldNotifyActors: true,
    };

    await expectPromiseToFailWithError(
      usecase.execute(input),
      errors.agency.notFound({ agencyId: newAgency.id }),
    );
  });

  it("throw if previous agency not found", async () => {
    const input: TransferConventionToAgencyPayload = {
      agencyId: newAgency.id,
      convention,
      justification: "agency change",
      previousAgencyId: previousAgency.id,
      shouldNotifyActors: true,
    };

    await expectPromiseToFailWithError(
      usecase.execute(input),
      errors.agency.notFound({ agencyId: previousAgency.id }),
    );
  });

  it("throw if convention not found", async () => {
    uow.agencyRepository.agencies = [
      toAgencyWithRights(previousAgency, {}),
      toAgencyWithRights(newAgency, {}),
    ];

    const input: TransferConventionToAgencyPayload = {
      agencyId: newAgency.id,
      convention,
      justification: "agency change",
      previousAgencyId: previousAgency.id,
      shouldNotifyActors: true,
    };

    await expectPromiseToFailWithError(
      usecase.execute(input),
      errors.convention.notFound({ conventionId: convention.id }),
    );
  });

  it("should notify agency and signatories that convention has been transferred", async () => {
    uow.agencyRepository.agencies = [
      toAgencyWithRights(previousAgency, {}),
      toAgencyWithRights(newAgency, {
        [connectedUser.id]: {
          roles: ["validator", "counsellor"],
          isNotifiedByEmail: true,
        },
      }),
    ];
    uow.userRepository.users = [connectedUser];
    uow.conventionRepository.setConventions([convention]);

    await usecase.execute({
      agencyId: newAgency.id,
      convention,
      justification: "agency change",
      previousAgencyId: previousAgency.id,
      shouldNotifyActors: true,
    });

    const makeManageConventionLink = (
      loginPersona: "beneficiary" | "professional",
    ) =>
      makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: convention.id,
          loginPersona,
        }),
        baseUrl: config.immersionFacileBaseUrl,
      });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION",
          recipients: [connectedUser.email],
          params: {
            internshipKind: convention.internshipKind,
            beneficiaryEmail: convention.signatories.beneficiary.email,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            beneficiaryPhone: convention.signatories.beneficiary.phone,
            previousAgencyName: previousAgency.name,
            justification: "agency change",
            manageConventionLink: makeRouteAbsoluteUrl({
              route: frontRoutes.manageConventionConnectedUser({
                conventionId: convention.id,
              }),
              baseUrl: config.immersionFacileBaseUrl,
            }),
            conventionId: convention.id,
          },
        },
        {
          kind: "CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            internshipKind: convention.internshipKind,
            immersionProfession:
              convention.immersionAppellation.appellationLabel,
            previousAgencyName: previousAgency.name,
            newAgencyName: newAgency.name,
            agencyAddress: `${newAgency.address.streetNumberAndAddress} ${newAgency.address.postcode} ${newAgency.address.city}`,
            businessName: convention.businessName,
            justification: "agency change",
            manageConventionLink: makeManageConventionLink("beneficiary"),
            conventionId: convention.id,
          },
        },
        {
          kind: "CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION",
          recipients: [
            convention.signatories.establishmentRepresentative.email,
          ],
          params: {
            internshipKind: convention.internshipKind,
            immersionProfession:
              convention.immersionAppellation.appellationLabel,
            previousAgencyName: previousAgency.name,
            newAgencyName: newAgency.name,
            agencyAddress: `${newAgency.address.streetNumberAndAddress} ${newAgency.address.postcode} ${newAgency.address.city}`,
            businessName: convention.businessName,
            justification: "agency change",
            manageConventionLink: makeManageConventionLink("professional"),
            conventionId: convention.id,
          },
        },
        {
          kind: "CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION",
          recipients: [convention.establishmentTutor.email],
          params: {
            internshipKind: convention.internshipKind,
            immersionProfession:
              convention.immersionAppellation.appellationLabel,
            previousAgencyName: previousAgency.name,
            newAgencyName: newAgency.name,
            agencyAddress: `${newAgency.address.streetNumberAndAddress} ${newAgency.address.postcode} ${newAgency.address.city}`,
            businessName: convention.businessName,
            justification: "agency change",
            manageConventionLink: makeManageConventionLink("professional"),
            conventionId: convention.id,
          },
        },
      ],
    });
  });

  it("does not notify when shouldNotifyActors is false", async () => {
    uow.agencyRepository.agencies = [
      toAgencyWithRights(previousAgency, {}),
      toAgencyWithRights(newAgency, {}),
    ];
    uow.conventionRepository.setConventions([convention]);

    await usecase.execute({
      agencyId: newAgency.id,
      convention,
      justification: "agency change",
      previousAgencyId: previousAgency.id,
      shouldNotifyActors: false,
    });

    expectSavedNotificationsAndEvents({ emails: [], sms: [] });
  });
});
