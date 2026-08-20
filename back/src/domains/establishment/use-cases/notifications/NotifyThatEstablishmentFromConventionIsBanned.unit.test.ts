import { addDays } from "date-fns";
import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  type ConventionStatus,
  reasonableSchedule,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import {
  makeSaveNotificationAndRelatedEvent,
  type SaveNotificationAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyThatEstablishmentFromConventionIsBanned,
  type NotifyThatEstablishmentFromConventionIsBanned,
} from "./NotifyThatEstablishmentFromConventionIsBanned";

const immersionBaseUrl = "https://immersion-facile.beta.gouv.fr";
const siret = "12345678901234";

describe("NotifyThatEstablishmentFromConventionIsBanned", () => {
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let notifyThatEstablishmentFromConventionIsBanned: NotifyThatEstablishmentFromConventionIsBanned;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(new Date("2024-10-15"));
    const saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent =
      makeSaveNotificationAndRelatedEvent(new UuidV4Generator(), timeGateway);
    notifyThatEstablishmentFromConventionIsBanned =
      makeNotifyThatEstablishmentFromConventionIsBanned({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent,
          immersionBaseUrl,
          timeGateway,
        },
      });
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  it.each<ConventionStatus>([
    "REJECTED",
    "CANCELLED",
    "DEPRECATED",
  ])("does not notify convention actors for status %s", async (status) => {
    const convention = new ConventionDtoBuilder()
      .withSiret(siret)
      .withStatus(status)
      .build();
    uow.conventionRepository.setConventions([convention]);

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("does not notify actors for a validated convention that ended today", async () => {
    const dateStart = addDays(timeGateway.now(), -2);
    const dateEnd = addDays(timeGateway.now(), 0);
    const convention = new ConventionDtoBuilder()
      .withSiret(siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(dateStart.toISOString())
      .withDateEnd(dateEnd.toISOString())
      .withSchedule(reasonableSchedule)
      .build();
    uow.conventionRepository.setConventions([convention]);

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("does not notify actors for a validated convention that ended yesterday", async () => {
    const dateStart = addDays(timeGateway.now(), -2);
    const dateEnd = addDays(timeGateway.now(), -1);
    const convention = new ConventionDtoBuilder()
      .withSiret(siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(dateStart.toISOString())
      .withDateEnd(dateEnd.toISOString())
      .withSchedule(reasonableSchedule)
      .build();
    uow.conventionRepository.setConventions([convention]);

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({ emails: [] });
  });

  it("notifies all convention actors when a validated convention has not ended", async () => {
    const dateStart = addDays(timeGateway.now(), -1);
    const dateEnd = addDays(timeGateway.now(), 1);
    const validator = new UserBuilder()
      .withId("validator-id")
      .withEmail("validator@example.com")
      .build();
    const counsellor = new UserBuilder()
      .withId("counsellor-id")
      .withEmail("counsellor@example.com")
      .build();
    const agency = new AgencyDtoBuilder().withId("agency-id").build();
    const convention = new ConventionDtoBuilder()
      .withSiret(siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withAgencyId(agency.id)
      .withDateStart(dateStart.toISOString())
      .withDateEnd(dateEnd.toISOString())
      .withSchedule(reasonableSchedule)
      .withBusinessName("Banned establishment")
      .withBeneficiaryEmail("beneficiary@example.com")
      .withBeneficiaryFirstName("Jean")
      .withBeneficiaryLastName("Dupont")
      .withEstablishmentRepresentativeEmail("representative@example.com")
      .build();
    uow.conventionRepository.setConventions([convention]);
    uow.userRepository.users = [validator, counsellor];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: {
          roles: ["validator"],
          isNotifiedByEmail: true,
        },
        [counsellor.id]: {
          roles: ["counsellor"],
          isNotifiedByEmail: true,
        },
      }),
    ];

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            businessName: convention.businessName,
            beneficiaryFirstName: convention.signatories.beneficiary.firstName,
            beneficiaryLastName: convention.signatories.beneficiary.lastName,
            immersionBaseUrl,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
          recipients: [
            convention.signatories.establishmentRepresentative.email,
          ],
          params: {
            businessName: convention.businessName,
            siret: convention.siret,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
          recipients: [validator.email, counsellor.email],
          params: {
            businessName: convention.businessName,
            beneficiaryFirstName: convention.signatories.beneficiary.firstName,
            beneficiaryLastName: convention.signatories.beneficiary.lastName,
            immersionBaseUrl,
            conventionId: convention.id,
          },
        },
      ],
    });
  });

  it.each<ConventionStatus>([
    "READY_TO_SIGN",
    "PARTIALLY_SIGNED",
    "IN_REVIEW",
    "ACCEPTED_BY_COUNSELLOR",
  ])("notifies the beneficiary and establishment representative for a convention with status %s", async (status) => {
    const convention = new ConventionDtoBuilder()
      .withSiret(siret)
      .withStatus(status)
      .withBusinessName("Entreprise interdite")
      .withBeneficiaryEmail("beneficiary@example.com")
      .withBeneficiaryFirstName("Jean")
      .withBeneficiaryLastName("Dupont")
      .withEstablishmentRepresentativeEmail("representative@example.com")
      .build();
    uow.conventionRepository.setConventions([convention]);

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
          recipients: [convention.signatories.beneficiary.email],
          params: {
            businessName: convention.businessName,
            beneficiaryFirstName: convention.signatories.beneficiary.firstName,
            beneficiaryLastName: convention.signatories.beneficiary.lastName,
            immersionBaseUrl,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
          recipients: [
            convention.signatories.establishmentRepresentative.email,
          ],
          params: {
            businessName: convention.businessName,
            siret: convention.siret,
          },
        },
      ],
    });
  });

  it("only notifies actors of banned establishments for eligible conventions (mixed test)", async () => {
    const validator = new UserBuilder()
      .withId("validator-id")
      .withEmail("validator@example.com")
      .build();
    const agency = new AgencyDtoBuilder().withId("agency-id").build();
    const conventionForNonBannedEstablishment = new ConventionDtoBuilder()
      .withId("00000000-0000-4000-8000-000000000001")
      .withSiret("98765432109876")
      .withStatus("READY_TO_SIGN")
      .build();
    const conventionWithIneligibleStatus = new ConventionDtoBuilder()
      .withId("00000000-0000-4000-8000-000000000002")
      .withSiret(siret)
      .withStatus("REJECTED")
      .build();
    const endedValidatedConvention = new ConventionDtoBuilder()
      .withId("00000000-0000-4000-8000-000000000003")
      .withSiret(siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart(addDays(timeGateway.now(), -2).toISOString())
      .withDateEnd(addDays(timeGateway.now(), -1).toISOString())
      .withSchedule(reasonableSchedule)
      .build();
    const directNotificationConvention = new ConventionDtoBuilder()
      .withId("00000000-0000-4000-8000-000000000004")
      .withSiret(siret)
      .withStatus("READY_TO_SIGN")
      .withDateStart(addDays(timeGateway.now(), -2).toISOString())
      .withDateEnd(addDays(timeGateway.now(), -1).toISOString())
      .withSchedule(reasonableSchedule)
      .withBusinessName("Entreprise bannie à notifier directement")
      .withBeneficiaryEmail("direct-beneficiary@example.com")
      .withBeneficiaryFirstName("Direct")
      .withBeneficiaryLastName("Beneficiary")
      .withEstablishmentRepresentativeEmail("direct-representative@example.com")
      .build();
    const ongoingValidatedConvention = new ConventionDtoBuilder()
      .withId("00000000-0000-4000-8000-000000000005")
      .withSiret(siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withAgencyId(agency.id)
      .withDateStart(addDays(timeGateway.now(), -1).toISOString())
      .withDateEnd(addDays(timeGateway.now(), 1).toISOString())
      .withSchedule(reasonableSchedule)
      .withBusinessName("Entreprise bannie avec convention en cours")
      .withBeneficiaryEmail("ongoing-beneficiary@example.com")
      .withBeneficiaryFirstName("Ongoing")
      .withBeneficiaryLastName("Beneficiary")
      .withEstablishmentRepresentativeEmail(
        "ongoing-representative@example.com",
      )
      .build();
    uow.conventionRepository.setConventions([
      conventionForNonBannedEstablishment,
      conventionWithIneligibleStatus,
      endedValidatedConvention,
      directNotificationConvention,
      ongoingValidatedConvention,
    ]);
    uow.userRepository.users = [validator];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: {
          roles: ["validator"],
          isNotifiedByEmail: true,
        },
      }),
    ];

    await notifyThatEstablishmentFromConventionIsBanned.execute({ siret });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
          recipients: [
            directNotificationConvention.signatories.beneficiary.email,
          ],
          params: {
            businessName: directNotificationConvention.businessName,
            beneficiaryFirstName:
              directNotificationConvention.signatories.beneficiary.firstName,
            beneficiaryLastName:
              directNotificationConvention.signatories.beneficiary.lastName,
            immersionBaseUrl,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
          recipients: [
            directNotificationConvention.signatories.establishmentRepresentative
              .email,
          ],
          params: {
            businessName: directNotificationConvention.businessName,
            siret: directNotificationConvention.siret,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
          recipients: [
            ongoingValidatedConvention.signatories.beneficiary.email,
          ],
          params: {
            businessName: ongoingValidatedConvention.businessName,
            beneficiaryFirstName:
              ongoingValidatedConvention.signatories.beneficiary.firstName,
            beneficiaryLastName:
              ongoingValidatedConvention.signatories.beneficiary.lastName,
            immersionBaseUrl,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
          recipients: [
            ongoingValidatedConvention.signatories.establishmentRepresentative
              .email,
          ],
          params: {
            businessName: ongoingValidatedConvention.businessName,
            siret: ongoingValidatedConvention.siret,
          },
        },
        {
          kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
          recipients: [validator.email],
          params: {
            businessName: ongoingValidatedConvention.businessName,
            beneficiaryFirstName:
              ongoingValidatedConvention.signatories.beneficiary.firstName,
            beneficiaryLastName:
              ongoingValidatedConvention.signatories.beneficiary.lastName,
            immersionBaseUrl,
            conventionId: ongoingValidatedConvention.id,
          },
        },
      ],
    });
  });
});
