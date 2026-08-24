import { subDays, subHours } from "date-fns";
import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  expectObjectInArrayToMatch,
  expectToEqual,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeCreateNewEvent } from "../../core/events/ports/EventBus";
import { makeSaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type { EstablishmentLead } from "../entities/EstablishmentLeadEntity";
import {
  makeSendEstablishmentLeadReminderScript,
  type SendEstablishmentLeadReminderScript,
} from "./SendEstablishmentLeadReminderScript";

const now = new Date("2021-05-15T08:00:00.000Z");
const establishmentLeadAccepted: EstablishmentLead = {
  siret: "12345678901234",
  lastEventKind: "registration-accepted",
  events: [
    {
      conventionId: "45664444-1234-4000-4444-123456789013",
      occurredAt: subDays(now, 2),
      kind: "to-be-reminded",
    },
    {
      occurredAt: now,
      kind: "registration-accepted",
    },
  ],
};

const establishmentLeadToBeReminded: EstablishmentLead = {
  siret: "12345678901235",
  lastEventKind: "to-be-reminded",
  events: [
    {
      conventionId: "45664444-1234-4000-4444-123456789012",
      occurredAt: subDays(now, 2),
      kind: "to-be-reminded",
    },
  ],
};

const establishmentLeadWithOneReminderSentSevenDaysAgo: EstablishmentLead = {
  siret: "12345678901236",
  lastEventKind: "reminder-sent",
  events: [
    {
      conventionId: "45664444-1234-4000-4444-123456789012",
      occurredAt: subDays(now, 8),
      kind: "to-be-reminded",
    },
    {
      kind: "reminder-sent",
      occurredAt: subDays(subHours(now, 2), 7),
      notification: { id: "first-notification-id", kind: "email" },
    },
  ],
};
const establishmentLeadWithOneReminderSentYesterday: EstablishmentLead = {
  siret: "12345678901230",
  lastEventKind: "reminder-sent",
  events: [
    {
      conventionId: "45664444-1234-4000-4444-123456789014",
      occurredAt: subDays(now, 8),
      kind: "to-be-reminded",
    },
    {
      kind: "reminder-sent",
      occurredAt: subDays(now, 1),
      notification: { id: "first-notification-id", kind: "email" },
    },
  ],
};

const establishmentLeadWithTwoRemindersSent: EstablishmentLead = {
  siret: "12345678901237",
  lastEventKind: "reminder-sent",
  events: [
    {
      conventionId: "45664444-1234-4000-4444-123456789013",
      occurredAt: subDays(now, 15),
      kind: "to-be-reminded",
    },
    {
      kind: "reminder-sent",
      occurredAt: subDays(now, 14),
      notification: { id: "first-notification-id", kind: "email" },
    },
    {
      kind: "reminder-sent",
      occurredAt: subDays(now, 7),
      notification: { id: "second-notification-id", kind: "email" },
    },
  ],
};

describe("SendEstablishmentLeadReminder", () => {
  const config: AppConfig = new AppConfigBuilder()
    .withTestPresetPreviousKeys()
    .build();
  const timeGateway = new CustomTimeGateway(new Date());
  let uow: InMemoryUnitOfWork;
  let sendEstablishmentLeadReminder: SendEstablishmentLeadReminderScript;
  let shortLinkIdGeneratorGateway: DeterministShortLinkIdGeneratorGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    shortLinkIdGeneratorGateway = new DeterministShortLinkIdGeneratorGateway();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    sendEstablishmentLeadReminder = makeSendEstablishmentLeadReminderScript({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        config,
        createNewEvent: makeCreateNewEvent({
          timeGateway,
          uuidGenerator: new UuidV4Generator(),
        }),
        generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
        shortLinkIdGeneratorGateway,
        timeGateway,
      },
    });
  });

  describe("Send first reminder", () => {
    it("Send emails to establishment lead when lastEventKind = 'to-be-reminded", async () => {
      const agency = new AgencyDtoBuilder().build();
      const newestConvention = new ConventionDtoBuilder()
        .withId("11111111-ee70-4c90-b3f4-668d492f7395")
        .withSiret(establishmentLeadToBeReminded.siret)
        .withDateValidation(subDays(now, 2).toISOString())
        .withAgencyId(agency.id)
        .withEstablishmentRepresentativeEmail(
          "newestConvention.establishment@email.fr",
        )
        .build();
      const oldestConvention = new ConventionDtoBuilder()
        .withId("22222222-ee70-4c90-b3f4-668d492f7395")
        .withSiret(establishmentLeadToBeReminded.siret)
        .withDateValidation(subDays(now, 10).toISOString())
        .withAgencyId(agency.id)
        .withEstablishmentRepresentativeEmail(
          "oldestConvention.establishment@email.fr",
        )
        .build();
      uow.establishmentLeadRepository.establishmentLeads = [
        establishmentLeadAccepted,
        establishmentLeadToBeReminded,
      ];
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      uow.conventionRepository.setConventions([
        oldestConvention,
        newestConvention,
      ]);
      shortLinkIdGeneratorGateway.addMoreShortLinkIds([
        "addEstablishmentFormShortLink",
        "addUnsubscribeToEmailShortLink",
      ]);
      timeGateway.setNextDates([now, now]);

      const result = await sendEstablishmentLeadReminder.execute({
        kind: "to-be-reminded",
      });

      expectToEqual(result, {
        establishmentsReminded: [establishmentLeadToBeReminded.siret],
        errors: {},
      });

      const expectedFakeJwtPayload =
        "11111111-ee70-4c90-b3f4-668d492f7395%2Festablishment-representative%2F2021-05-15T08%3A00%3A00.000Z%2FnewestConvention.establishment%40email.fr%2F1Month";

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: "addEstablishmentFormShortLink",
          lastUsedAt: null,
          url: `http://localhost/establishment?at_campaign=transactionnel-etablissement-rappel-inscription&fromConventionId=${newestConvention.id}`,
        },
        {
          id: "addUnsubscribeToEmailShortLink",
          lastUsedAt: null,
          url: `http://fake-magic-link/desinscription-prospect?jwt=${expectedFakeJwtPayload}`,
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_LEAD_REMINDER",
            params: {
              businessName: newestConvention.businessName,
              registerEstablishmentShortLink:
                "http://localhost/api/to/addEstablishmentFormShortLink",
              unsubscribeToEmailShortLink:
                "http://localhost/api/to/addUnsubscribeToEmailShortLink",
            },
            recipients: [
              newestConvention.signatories.establishmentRepresentative.email,
            ],
            sender: {
              email: "ne-pas-ecrire-a-cet-email@immersion-facile.beta.gouv.fr",
              name: "Immersion Facilitée",
            },
          },
        ],
      });

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
        {
          topic: "EstablishmentLeadReminderSent",
          payload: {
            id: newestConvention.id,
          },
        },
      ]);

      expect(
        (
          await uow.establishmentLeadRepository.getBySiret(
            newestConvention.siret,
          )
        )?.lastEventKind,
      ).toBe("reminder-sent");
    });
  });

  describe("Send second reminder", () => {
    it("Send emails to establishment lead when lastEventKind ='reminder-sent' and only one reminder event sent 7 day ago", async () => {
      const agency = new AgencyDtoBuilder().build();

      const convention1 = new ConventionDtoBuilder()
        .withId("45664444-1234-4000-4444-123456789012")
        .withSiret(establishmentLeadWithOneReminderSentSevenDaysAgo.siret)
        .withDateValidation(subDays(now, 2).toISOString())
        .withAgencyId(agency.id)
        .build();

      const convention2 = new ConventionDtoBuilder()
        .withId("45664444-1234-4000-4444-123456789013")
        .withSiret(establishmentLeadWithTwoRemindersSent.siret)
        .withDateValidation(subDays(now, 2).toISOString())
        .withAgencyId(agency.id)
        .build();

      const convention3 = new ConventionDtoBuilder()
        .withId("45664444-1234-4000-4444-123456789014")
        .withSiret(establishmentLeadWithOneReminderSentYesterday.siret)
        .withDateValidation(subDays(now, 2).toISOString())
        .withAgencyId(agency.id)
        .build();

      uow.establishmentLeadRepository.establishmentLeads = [
        establishmentLeadWithOneReminderSentSevenDaysAgo,
        establishmentLeadWithTwoRemindersSent,
        establishmentLeadWithOneReminderSentYesterday,
      ];

      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
      uow.conventionRepository.setConventions([
        convention1,
        convention2,
        convention3,
      ]);
      shortLinkIdGeneratorGateway.addMoreShortLinkIds([
        "addEstablishmentFormShortLink",
        "addUnsubscribeToEmailShortLink",
      ]);
      timeGateway.setNextDates([now, now]);

      const result = await sendEstablishmentLeadReminder.execute({
        kind: "reminder-sent",
        beforeDate: subDays(now, 7),
      });

      expectToEqual(result, {
        establishmentsReminded: [
          establishmentLeadWithOneReminderSentSevenDaysAgo.siret,
        ],
        errors: {},
      });

      const expectedFakeJwtPayload =
        "45664444-1234-4000-4444-123456789012%2Festablishment-representative%2F2021-05-15T08%3A00%3A00.000Z%2Festablishment%40example.com%2F1Month";

      expectToEqual(uow.shortLinkRepository.getShortLinks(), [
        {
          id: "addEstablishmentFormShortLink",
          lastUsedAt: null,
          url: `http://localhost/establishment?at_campaign=transactionnel-etablissement-rappel-inscription&fromConventionId=${convention1.id}`,
        },
        {
          id: "addUnsubscribeToEmailShortLink",
          lastUsedAt: null,
          url: `http://fake-magic-link/desinscription-prospect?jwt=${expectedFakeJwtPayload}`,
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_LEAD_REMINDER",
            params: {
              businessName: convention1.businessName,
              registerEstablishmentShortLink:
                "http://localhost/api/to/addEstablishmentFormShortLink",
              unsubscribeToEmailShortLink:
                "http://localhost/api/to/addUnsubscribeToEmailShortLink",
            },
            recipients: [
              convention1.signatories.establishmentRepresentative.email,
            ],
            sender: {
              email: "ne-pas-ecrire-a-cet-email@immersion-facile.beta.gouv.fr",
              name: "Immersion Facilitée",
            },
          },
        ],
      });

      expectObjectInArrayToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
        {
          topic: "EstablishmentLeadReminderSent",
          payload: {
            id: convention1.id,
          },
        },
      ]);

      expect(
        (await uow.establishmentLeadRepository.getBySiret(convention1.siret))
          ?.lastEventKind,
      ).toBe("reminder-sent");
    });
  });
});
