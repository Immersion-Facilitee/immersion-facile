import type {
  AgencyId,
  ConventionId,
  DateRange,
  Email,
  EmailNotification,
  EmailType,
  Notification,
  NotificationId,
  NotificationKind,
  NotificationState,
  PhoneNumber,
  SmsNotification,
  TemplatedSms,
  UserId,
} from "shared";

export type EmailNotificationFilters = {
  email?: Email;
  emailType?: EmailType;
  conventionId?: ConventionId;
  agencyId?: AgencyId;
  createdAt?: Date;
  offset?: number;
  limit?: number;
};

export type SmsNotificationFilters = {
  recipientPhoneNumber: PhoneNumber;
  conventionId: ConventionId;
  smsKind: TemplatedSms["kind"];
};

export type EmailNotificationForReminderFilters = {
  recipientEmail: Email;
  conventionId: ConventionId;
  emailKind: EmailType;
};

export type DeleteNotificationsParams = {
  limit: number;
  createdAt: {
    to: Date;
  };
};

export type FilterUserDeletionWarningNotificationsParams = {
  userIds: UserId[];
} & (
  | { excludeWarnedSince: Date; onlyWarnedBetween?: never }
  | { onlyWarnedBetween: DateRange; excludeWarnedSince?: never }
);

export interface NotificationRepository {
  deleteOldestNotifications(params: DeleteNotificationsParams): Promise<number>;
  getSmsByIds: (ids: NotificationId[]) => Promise<SmsNotification[]>;
  getEmailsByIds: (ids: NotificationId[]) => Promise<EmailNotification[]>;
  save: (notification: Notification) => Promise<void>;
  updateState: (params: {
    notificationId: NotificationId;
    notificationKind: NotificationKind;
    state: NotificationState | undefined;
  }) => Promise<void>;
  saveBatch: (notifications: Notification[]) => Promise<void>;
  getByIdAndKind: (
    id: NotificationId,
    kind: NotificationKind,
  ) => Promise<Notification | undefined>;
  getLastNotifications: () => Promise<{
    emails: EmailNotification[];
    sms: SmsNotification[];
  }>;
  getEmailsByFilters: (
    filters: EmailNotificationFilters,
  ) => Promise<EmailNotification[]>;
  deleteAllEmailAttachements: () => Promise<number>;
  getLastSmsNotificationByFilter: (
    filters: SmsNotificationFilters,
  ) => Promise<SmsNotification | undefined>;
  getLastEmailNotificationByFilter: (
    filters: EmailNotificationForReminderFilters,
  ) => Promise<EmailNotification | undefined>;
  filterUserDeletionWarningNotifications(
    params: FilterUserDeletionWarningNotificationsParams,
  ): Promise<UserId[]>;
}
