import {
  type EmailNotification,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type NotificationErrored,
  type SmsNotification,
  type TemplatedEmail,
  type TemplatedSms,
} from "shared";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../events/ports/EventBus";
import { CustomTimeGateway } from "../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../uuid-generator/adapters/UuidGeneratorImplementations";
import {
  emailThatTriggerSendEmailError400,
  fakeHttpStatus400ErrorCode,
  fakeHttpStatus555ErrorCode,
  InMemoryNotificationGateway,
  sendSmsError400PhoneNumber,
  sendSmsError555PhoneNumber,
} from "../adapters/InMemoryNotificationGateway";
import {
  makeSendNotification,
  type SendNotification,
} from "./SendNotification";

const someDate = new Date("2023-01-01").toISOString();

describe("SendNotification UseCase", () => {
  let notificationGateway: InMemoryNotificationGateway;
  let sendNotification: SendNotification;
  let createNewEvent: CreateNewEvent;
  let uow: InMemoryUnitOfWork;
  const now = new Date();

  beforeEach(() => {
    notificationGateway = new InMemoryNotificationGateway();
    uow = createInMemoryUow();

    const timeGateway = new CustomTimeGateway();
    timeGateway.setNextDate(now);

    createNewEvent = makeCreateNewEvent({
      timeGateway: timeGateway,
      uuidGenerator: new TestUuidGenerator(),
    });
    sendNotification = makeSendNotification({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        notificationGateway,
        timeGateway,
        createNewEvent,
      },
    });
  });

  describe("Wrong paths", () => {
    it("should throw if notification not found", async () => {
      const id = "notif-404";
      const kind = "email";
      await expectPromiseToFailWithError(
        sendNotification.execute({ id, kind }),
        errors.notification.notFound({ id, kind }),
      );
    });

    describe("when error occurres in SMS or email sending", () => {
      it("should throw if http status is 500 or higher", async () => {
        const id = "notif-sms-id";

        const smsNotification: SmsNotification = {
          id,
          kind: "sms",
          templatedContent: {
            kind: "ReminderForSignatories",
            params: { shortLink: "https://my-link.com" },
            recipientPhone: `33${sendSmsError555PhoneNumber.substring(1)}`,
          },
          createdAt: someDate,
          followedIds: { conventionId: "convention-123" },
        };

        uow.notificationRepository.notifications = [smsNotification];

        const errorMessage =
          "fake Send SMS Error with phone number 33699000555.";

        await expectPromiseToFailWithError(
          sendNotification.execute({ id, kind: "sms" }),
          errors.generic.unsupportedStatus({
            status: fakeHttpStatus555ErrorCode,
            body: errorMessage,
            serviceName: "Brevo",
          }),
        );
      });

      it("stores the error in the notification (and not send any event) when error is 4xx", async () => {
        const id = "notif-sms-id";

        const smsNotification: SmsNotification = {
          id,
          kind: "sms",
          templatedContent: {
            kind: "ReminderForSignatories",
            params: { shortLink: "https://my-link.com" },
            recipientPhone: `33${sendSmsError400PhoneNumber.substring(1)}`,
          },
          createdAt: someDate,
          followedIds: { conventionId: "convention-123" },
        };

        uow.notificationRepository.notifications = [smsNotification];

        const errorMessage =
          "fake Send SMS Error with phone number 33699000400.";

        await sendNotification.execute({ id, kind: "sms" });

        const notificationState: NotificationErrored = {
          status: "errored",
          occurredAt: now.toISOString(),
          httpStatus: fakeHttpStatus400ErrorCode,
          message: errorMessage,
        };

        expectToEqual(uow.notificationRepository.notifications, [
          {
            ...smsNotification,
            state: notificationState,
          },
        ]);
        expectArraysToMatch(uow.outboxRepository.events, []);
      });

      describe("when the notification is a DISCUSSION_EXCHANGE", () => {
        const emailNotification: EmailNotification = {
          id: "notif-email-id-that-throws",
          kind: "email",
          templatedContent: {
            kind: "DISCUSSION_EXCHANGE",
            params: {} as any,
            recipients: [emailThatTriggerSendEmailError400],
          },
          createdAt: someDate,
          followedIds: {},
        };

        it("should dispatch an event when it was a discussion exchange notification failed to deliver (with 4xx)", async () => {
          uow.notificationRepository.notifications = [emailNotification];

          const notificationState: NotificationErrored = {
            status: "errored",
            occurredAt: now.toISOString(),
            httpStatus: fakeHttpStatus400ErrorCode,
            message: `fake Send Email Error with email ${emailThatTriggerSendEmailError400}`,
          };

          await sendNotification.execute({
            id: emailNotification.id,
            kind: "email",
          });

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "DiscussionExchangeDeliveryFailed",
              payload: {
                notificationId: emailNotification.id,
                notificationKind: emailNotification.kind,
                errored: notificationState,
              },
            },
          ]);
        });

        it("does not trigger the event, if the notification was already errored, but it should update the notification", async () => {
          const alreadyErroredEmailNotif: EmailNotification = {
            ...emailNotification,
            state: {
              status: "errored",
              occurredAt: new Date().toISOString(),
              httpStatus: 404,
              message: "some error",
            },
          };

          uow.notificationRepository.notifications = [alreadyErroredEmailNotif];

          const notificationState: NotificationErrored = {
            status: "errored",
            occurredAt: now.toISOString(),
            httpStatus: fakeHttpStatus400ErrorCode,
            message: `fake Send Email Error with email ${emailThatTriggerSendEmailError400}`,
          };

          await sendNotification.execute({
            id: emailNotification.id,
            kind: "email",
          });

          expectArraysToMatch(uow.notificationRepository.notifications, [
            { ...alreadyErroredEmailNotif, state: notificationState },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, []);
        });

        it("does not trigger the event, if the notification was already errored, but it should update the notification event when it is finally successful", async () => {
          const alreadyErroredEmailNotif: EmailNotification = {
            ...emailNotification,
            templatedContent: {
              ...emailNotification.templatedContent,
              recipients: ["does-not-error@mail.com"],
            },
            state: {
              status: "errored",
              occurredAt: new Date().toISOString(),
              httpStatus: 404,
              message: "some error",
            },
          };

          uow.notificationRepository.notifications = [alreadyErroredEmailNotif];

          await sendNotification.execute({
            id: emailNotification.id,
            kind: "email",
          });

          expectArraysToMatch(uow.notificationRepository.notifications, [
            {
              ...alreadyErroredEmailNotif,
              state: {
                status: "accepted",
                occurredAt: now.toISOString(),
                messageIds:
                  // biome-ignore lint/style/noNonNullAssertion: included on test
                  alreadyErroredEmailNotif.templatedContent.recipients!,
              },
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, []);
        });
      });
    });
  });

  it("should send an email", async () => {
    const email: TemplatedEmail = {
      kind: "AGENCY_WAS_ACTIVATED",
      params: {
        agencyName: "My agency",
        agencyLogoUrl: undefined,
        refersToOtherAgency: false,
        agencyReferdToName: undefined,
        agencyDashboardUrl:
          "https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard",
      },
      recipients: ["bob@mail.com"],
      cc: [],
      replyTo: {
        email: "yolo@mail.com",
        name: "Yolo",
      },
    };

    const id = "notif-123";
    uow.notificationRepository.notifications = [
      {
        id,
        kind: "email",
        templatedContent: email,
        createdAt: someDate,
        followedIds: { agencyId: "agency-123" },
      },
    ];

    await sendNotification.execute({ id, kind: "email" });

    expect(notificationGateway.getSentEmails()).toEqual([email]);
  });

  it("should send an SMS", async () => {
    const sms: TemplatedSms = {
      kind: "ReminderForSignatories",
      params: { shortLink: "https://my-link.com" },
      recipientPhone: "33612345678",
    };

    const id = "notif-abc";
    uow.notificationRepository.notifications = [
      {
        id,
        kind: "sms",
        templatedContent: sms,
        createdAt: someDate,
        followedIds: { conventionId: "convention-123" },
      },
    ];

    await sendNotification.execute({ id, kind: "sms" });

    expect(notificationGateway.getSentSms()).toEqual([sms]);
  });
});
