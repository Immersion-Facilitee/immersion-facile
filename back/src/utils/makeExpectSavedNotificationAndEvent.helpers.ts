import { partition } from "ramda";
import {
  type EmailNotification,
  exhaustiveCheck,
  expectArraysToEqualIgnoringOrder,
  expectToEqual,
  type Notification,
  type NotificationKind,
  notificationKinds,
  type SmsNotification,
  type TemplatedEmail,
  type TemplatedSms,
} from "shared";
import type { InMemoryOutboxRepository } from "../domains/core/events/adapters/InMemoryOutboxRepository";
import type {
  EventPriority,
  NotificationAddedEvent,
} from "../domains/core/events/events";
import type { InMemoryNotificationRepository } from "../domains/core/notifications/adapters/InMemoryNotificationRepository";
import type { WithNotificationIdAndKind } from "../domains/core/notifications/helpers/Notification";

export type ExpectSavedNotificationsAndEvents = ({
  emails,
  sms,
  priority,
}: ExpectedNotifications) => void;

export const makeExpectSavedNotificationsAndEvents =
  (
    notificationRepository: InMemoryNotificationRepository,
    outboxRepository: InMemoryOutboxRepository,
  ): ExpectSavedNotificationsAndEvents =>
  ({ emails = [], sms = [], priority }) => {
    const paramsByKind = createParamsByKind(
      notificationRepository,
      emails,
      sms,
    );

    const notificationAddedEvents = outboxRepository.events.filter(
      (event): event is NotificationAddedEvent =>
        event.topic === "NotificationAdded",
    );

    if (priority !== undefined)
      notificationAddedEvents.forEach((event) => {
        expectToEqual(event.priority, priority);
      });

    notificationKinds.forEach(
      expectNotificationsOfKind(notificationAddedEvents, paramsByKind),
    );
  };

type ExpectedNotifications = {
  emails?: TemplatedEmail[];
  sms?: TemplatedSms[];
  priority?: EventPriority;
};

const createParamsByKind = (
  notificationRepository: InMemoryNotificationRepository,
  emails: TemplatedEmail[],
  sms: TemplatedSms[],
) => {
  const [emailNotifications, smsNotifications] = partition(({ kind }) => {
    switch (kind) {
      case "email":
        return true;
      case "sms":
        return false;
      default:
        return exhaustiveCheck(kind, { throwIfReached: true });
    }
  }, notificationRepository.notifications) as [
    EmailNotification[],
    SmsNotification[],
  ];

  return {
    email: {
      notificationsOfKind: emailNotifications,
      expectedTemplatedContent: emails,
    },
    sms: {
      notificationsOfKind: smsNotifications,
      expectedTemplatedContent: sms,
    },
  } satisfies ParamByKind;
};

type ParamByKind = {
  [K in NotificationKind]: {
    expectedTemplatedContent: Array<
      Extract<Notification, { kind: K }>["templatedContent"]
    >;
    notificationsOfKind: Array<Extract<Notification, { kind: K }>>;
  };
};

const expectNotificationsOfKind =
  (
    notificationAddedEvents: NotificationAddedEvent[],
    paramsByKind: ParamByKind,
  ) =>
  (kind: NotificationKind) => {
    const { notificationsOfKind, expectedTemplatedContent } =
      paramsByKind[kind];

    expectArraysToEqualIgnoringOrder(
      notificationsOfKind.map(({ templatedContent }) => templatedContent),
      expectedTemplatedContent,
    );

    expectArraysToEqualIgnoringOrder(
      notificationsOfKind.map(
        ({ id }): WithNotificationIdAndKind => ({ id, kind }),
      ),
      notificationAddedEvents
        .filter(({ payload }) => payload.kind === kind)
        .map(({ payload }) => payload),
    );
  };
