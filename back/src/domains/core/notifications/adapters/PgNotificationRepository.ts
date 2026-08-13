import { addDays } from "date-fns";
import { sql } from "kysely";
import { map, uniq } from "ramda";
import {
  type DateRange,
  type EmailNotification,
  exhaustiveCheck,
  type Notification,
  type NotificationId,
  type NotificationKind,
  type NotificationState,
  type NotificationsByKind,
  pipeWithValue,
  type SiretDto,
  type SmsNotification,
  type TemplatedEmail,
  type TemplatedSms,
  type UserId,
} from "shared";
import {
  isInArray,
  jsonBuildObject,
  jsonStripNulls,
  type KyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import type {
  DeleteNotificationsParams,
  EmailNotificationFilters,
  EmailNotificationForReminderFilters,
  FilterUserDeletionWarningNotificationsParams,
  NotificationRepository,
  SmsNotificationFilters,
} from "../ports/NotificationRepository";

const getDefaultNotificationState = (): NotificationState => ({
  status: "to-be-send",
  occurredAt: new Date().toISOString(),
});

const stripNullsFromNotification = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripNullsFromNotification) as T;
  return Object.fromEntries(
    Object.entries(value as object)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, stripNullsFromNotification(v)]),
  ) as T;
};

export class PgNotificationRepository implements NotificationRepository {
  constructor(
    private transaction: KyselyDb,
    private maxRetrievedNotifications = 30,
  ) {}

  async test_getAllNotifications(): Promise<Notification[]> {
    return [
      ...(await getSmsNotificationBuilder(this.transaction).execute()),
      ...(await getEmailsNotificationBuilder(this.transaction).execute()),
    ].map(({ notif }) => notif);
  }

  public async deleteOldestNotifications({
    createdAt,
    limit,
  }: DeleteNotificationsParams): Promise<number> {
    return this.transaction
      .with("email_candidates", (qb) =>
        qb
          .selectFrom("notifications_email")
          .select(({ eb }) => [
            "notifications_email.id",
            "notifications_email.created_at",
            eb.val("email").as("type"),
          ])
          .where("notifications_email.created_at", "<=", createdAt.to)
          .orderBy("created_at", "asc")
          .limit(limit),
      )
      .with("sms_candidates", (qb) =>
        qb
          .selectFrom("notifications_sms")
          .select(({ eb }) => [
            "notifications_sms.id",
            "notifications_sms.created_at",
            eb.val("sms").as("type"),
          ])
          .where("notifications_sms.created_at", "<=", createdAt.to)
          .orderBy("created_at", "asc")
          .limit(limit),
      )
      .with("to_delete", (qb) =>
        qb
          .selectFrom("email_candidates")
          .selectAll()
          .unionAll(qb.selectFrom("sms_candidates").selectAll())
          .orderBy("created_at", "asc")
          .orderBy("type", "desc") // type desc for delete sms by priority if some date email === date sms
          .limit(limit),
      )
      .with("deleted_email_recipients", (qb) =>
        qb
          .deleteFrom("notifications_email_recipients")
          .using("to_delete")
          .whereRef(
            "notifications_email_recipients.notifications_email_id",
            "=",
            "to_delete.id",
          )
          .where("to_delete.type", "=", "email"),
      )
      .with("deleted_emails", (qb) =>
        qb
          .deleteFrom("notifications_email")
          .using("to_delete")
          .whereRef("to_delete.id", "=", "notifications_email.id")
          .where("to_delete.type", "=", "email")
          .returning("notifications_email.id"),
      )
      .with("deleted_sms", (qb) =>
        qb
          .deleteFrom("notifications_sms")
          .using("to_delete")
          .whereRef("to_delete.id", "=", "notifications_sms.id")
          .where("to_delete.type", "=", "sms")
          .returning("notifications_sms.id"),
      )
      .selectFrom((qb) =>
        qb
          .selectFrom("deleted_emails")
          .select(({ fn }) => fn.count("deleted_emails.id").as("count"))
          .unionAll(
            qb
              .selectFrom("deleted_sms")
              .select(({ fn }) => fn.count("deleted_sms.id").as("count")),
          )
          .as("total"),
      )
      .select(({ fn }) => fn.sum("total.count").as("total_deleted"))
      .executeTakeFirst()
      .then((result) => (result ? Number(result.total_deleted) : 0));
  }

  public async getLastSmsNotificationByFilter(
    filters: SmsNotificationFilters,
  ): Promise<SmsNotification | undefined> {
    const result = await getSmsNotificationBuilder(this.transaction)
      .where("recipient_phone", "=", filters.recipientPhoneNumber)
      .where("convention_id", "=", filters.conventionId)
      .where("sms_kind", "=", filters.smsKind)
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    return result ? stripNullsFromNotification(result.notif) : undefined;
  }

  public async getLastEmailNotificationByFilter(
    filters: EmailNotificationForReminderFilters,
  ): Promise<EmailNotification | undefined> {
    const result = await getEmailsNotificationBuilder(this.transaction)
      .where("r.email", "=", filters.recipientEmail)
      .where("e.convention_id", "=", filters.conventionId)
      .where("e.email_kind", "=", filters.emailKind)
      .orderBy("e.created_at", "desc")
      .executeTakeFirst();

    return result ? stripNullsFromNotification(result.notif) : undefined;
  }

  public async deleteAllEmailAttachements(): Promise<number> {
    const response = await this.transaction
      .updateTable("notifications_email_attachments")
      .set({
        attachment: sql`jsonb_set(attachment::jsonb, '{content}', '"deleted-content"')`,
      })
      .where(sql<boolean>`attachment::jsonb ->> 'content' != 'deleted-content'`)
      .executeTakeFirst();

    return Number(response.numUpdatedRows);
  }

  public async getByIdAndKind(
    id: NotificationId,
    kind: NotificationKind,
  ): Promise<Notification | undefined> {
    switch (kind) {
      case "sms":
        return this.#getSmsNotificationById(id);
      case "email":
        return this.#getEmailNotificationById(id);
      default:
        exhaustiveCheck(kind, {
          variableName: "notificationKind",
          throwIfReached: true,
        });
    }
  }

  async getSmsByIds(ids: NotificationId[]): Promise<SmsNotification[]> {
    if (!ids.length) return [];
    return getSmsNotificationBuilder(this.transaction)
      .where("id", "in", ids)
      .execute()
      .then(map((row) => stripNullsFromNotification(row.notif)));
  }

  async getEmailsByIds(ids: NotificationId[]): Promise<EmailNotification[]> {
    if (!ids.length) return [];
    return getEmailsNotificationBuilder(this.transaction)
      .where("e.id", "in", ids)
      .execute()
      .then(map((row) => stripNullsFromNotification(row.notif)));
  }

  public async getEmailsByFilters(
    filters: EmailNotificationFilters,
  ): Promise<EmailNotification[]> {
    const startOfDay = filters.createdAt
      ? new Date(
          filters.createdAt.getFullYear(),
          filters.createdAt.getMonth(),
          filters.createdAt.getDate(),
        )
      : null;
    const dateRange: DateRange | null = startOfDay
      ? {
          from: startOfDay,
          to: addDays(startOfDay, 1),
        }
      : null;
    return pipeWithValue(
      getEmailsNotificationBuilder(this.transaction),
      (qb) =>
        dateRange
          ? qb.where((qb) =>
              qb.between(qb.ref("e.created_at"), dateRange.from, dateRange.to),
            )
          : qb,
      (qb) =>
        filters.emailType
          ? qb.where("e.email_kind", "=", filters.emailType)
          : qb,
      (qb) => (filters.email ? qb.where("r.email", "=", filters?.email) : qb),
      (qb) =>
        filters.conventionId
          ? qb.where("e.convention_id", "=", filters?.conventionId)
          : qb,
      (qb) =>
        filters.agencyId ? qb.where("e.agency_id", "=", filters.agencyId) : qb,
    )
      .orderBy("e.created_at", "desc")
      .limit(filters.limit ?? this.maxRetrievedNotifications)
      .offset(filters.offset ?? 0)
      .execute()
      .then(map((row) => stripNullsFromNotification(row.notif)));
  }

  public async getLastNotifications(): Promise<NotificationsByKind> {
    return getSmsNotificationBuilder(this.transaction)
      .where("created_at", ">", sql<Date>`NOW() - INTERVAL '2 day'`)
      .limit(this.maxRetrievedNotifications)
      .execute()
      .then(async (rows) => ({
        emails: await this.#getLastEmails(),
        sms: rows.map((row) => stripNullsFromNotification(row.notif)),
      }));
  }

  async #getLastEmails(): Promise<EmailNotification[]> {
    return getEmailsNotificationBuilder(this.transaction)
      .where("e.created_at", ">", sql<Date>`NOW() - INTERVAL '2 day'`)
      .orderBy("e.created_at", "desc")
      .limit(this.maxRetrievedNotifications)
      .execute()
      .then(map((row) => stripNullsFromNotification(row.notif)));
  }

  public async save(notification: Notification): Promise<void> {
    switch (notification.kind) {
      case "sms":
        return this.#saveSmsNotification(notification);
      case "email": {
        return this.#saveEmailNotifications([notification]);
      }
      default:
        return exhaustiveCheck(notification, {
          variableName: "notificationKind",
          throwIfReached: true,
        });
    }
  }

  public async saveBatch(notifications: Notification[]): Promise<void> {
    const { smsNotifications, emailNotifications } = notifications.reduce(
      (acc, notification) => {
        if (notification.kind === "sms")
          return {
            ...acc,
            smsNotifications: [...acc.smsNotifications, notification],
          };

        return {
          ...acc,
          emailNotifications: [...acc.emailNotifications, notification],
        };
      },
      {
        smsNotifications: [] as SmsNotification[],
        emailNotifications: [] as EmailNotification[],
      },
    );

    if (smsNotifications.length > 0)
      await this.#saveSmsNotifications(smsNotifications);

    if (emailNotifications.length > 0)
      await this.#saveEmailNotifications(emailNotifications);
  }

  async updateState({
    notificationId,
    notificationKind,
    state: newState,
  }: {
    notificationId: NotificationId;
    notificationKind: NotificationKind;
    state: NotificationState | undefined;
  }) {
    const state = newState ? JSON.stringify(newState) : null;

    if (notificationKind === "email") {
      await this.transaction
        .updateTable("notifications_email")
        .set({ state })
        .where("id", "=", notificationId)
        .execute();
    }

    if (notificationKind === "sms") {
      await this.transaction
        .updateTable("notifications_sms")
        .set({ state })
        .where("id", "=", notificationId)
        .execute();
    }
  }

  async #getSmsNotificationById(
    id: NotificationId,
  ): Promise<SmsNotification | undefined> {
    const templatedSms = await this.getSmsByIds([id]);
    return templatedSms[0];
  }

  async #saveEmailNotifications(
    notifications: EmailNotification[],
  ): Promise<void> {
    const emailNotification = notifications.map((notification) =>
      dedupRecipientsAndCc(notification),
    );

    await this.#insertEmailNotifications(emailNotification);
    await this.#insertEmailsRecipients(emailNotification);
    await this.#insertEmailAttachments(emailNotification);
  }

  async #saveSmsNotification(notification: SmsNotification): Promise<void> {
    await this.#saveSmsNotifications([notification]);
  }

  async #saveSmsNotifications(notifications: SmsNotification[]): Promise<void> {
    if (notifications.length)
      await this.transaction
        .insertInto("notifications_sms")
        .values(
          notifications.map((notification) => ({
            id: notification.id,
            created_at: notification.createdAt,
            sms_kind: notification.templatedContent.kind,
            recipient_phone: notification.templatedContent.recipientPhone,
            convention_id: notification.followedIds.conventionId,
            user_id: notification.followedIds.userId,
            establishment_siret: notification.followedIds.establishmentSiret,
            agency_id: notification.followedIds.agencyId,
            params: JSON.stringify(notification.templatedContent.params),
            state: JSON.stringify(
              notification.state ?? getDefaultNotificationState(),
            ),
          })),
        )
        .execute();
  }

  async #insertEmailAttachments(
    notifications: EmailNotification[],
  ): Promise<void> {
    const attachments: {
      notifications_email_id: NotificationId;
      attachment: string;
    }[] = notifications.flatMap((notification) =>
      (notification.templatedContent.attachments ?? []).map((attachment) => ({
        notifications_email_id: notification.id,
        attachment: JSON.stringify(attachment),
      })),
    );

    if (attachments.length)
      await this.transaction
        .insertInto("notifications_email_attachments")
        .values(attachments)
        .execute();
  }

  async #insertEmailsRecipients(
    notifications: EmailNotification[],
  ): Promise<void> {
    const recipients = notifications.flatMap((notification) => [
      ...notification.templatedContent.recipients.map((recipient) => ({
        notifications_email_id: notification.id,
        email: recipient,
        recipient_type: "to" as const,
      })),
      ...(notification.templatedContent.cc ?? []).map((ccRecipient) => ({
        notifications_email_id: notification.id,
        email: ccRecipient,
        recipient_type: "cc" as const,
      })),
    ]);

    await this.transaction
      .insertInto("notifications_email_recipients")
      .values(recipients)
      .execute();
  }

  async #insertEmailNotifications(notifications: EmailNotification[]) {
    await this.transaction
      .insertInto("notifications_email")
      .values(
        notifications.map(
          ({ id, createdAt, followedIds, templatedContent, state }) => ({
            id: id,
            created_at: createdAt,
            email_kind: templatedContent.kind,
            convention_id: followedIds.conventionId,
            user_id: followedIds.userId,
            establishment_siret: followedIds.establishmentSiret,
            agency_id: followedIds.agencyId,
            params: JSON.stringify(templatedContent.params),
            reply_to_name: templatedContent.replyTo?.name,
            reply_to_email: templatedContent.replyTo?.email,
            sender_email: templatedContent.sender?.email,
            sender_name: templatedContent.sender?.name,
            state: JSON.stringify(state ?? getDefaultNotificationState()),
          }),
        ),
      )
      .execute();
  }

  async #getEmailNotificationById(
    id: NotificationId,
  ): Promise<EmailNotification | undefined> {
    const emails = await this.getEmailsByIds([id]);
    return emails[0];
  }

  public async filterUserDeletionWarningNotifications(
    params: FilterUserDeletionWarningNotificationsParams,
  ): Promise<UserId[]> {
    if (params.userIds.length === 0) return [];

    const rows = await pipeWithValue(
      this.transaction
        .selectFrom("notifications_email")
        .where((eb) =>
          isInArray(eb, "notifications_email.user_id", params.userIds),
        )
        .where(
          "notifications_email.email_kind",
          "=",
          "ACCOUNT_DELETION_WARNING",
        ),
      (q) =>
        params.excludeWarnedSince
          ? q.where(
              "notifications_email.created_at",
              ">=",
              params.excludeWarnedSince,
            )
          : q
              .where(
                "notifications_email.created_at",
                ">=",
                params.onlyWarnedBetween.from,
              )
              .where(
                "notifications_email.created_at",
                "<=",
                params.onlyWarnedBetween.to,
              ),
      (q) => q.select("notifications_email.user_id").distinct().execute(),
    );

    return rows
      .map((r) => r.user_id)
      .filter((userId): userId is UserId => userId !== null);
  }

  public async filterEstablishmentSiretsAlreadySuggestedReengagement({
    sirets,
    suggestedSince,
  }: {
    sirets: SiretDto[];
    suggestedSince: Date;
  }): Promise<SiretDto[]> {
    if (sirets.length === 0) return [];

    const rows = await this.transaction
      .selectFrom("notifications_email")
      .where((eb) =>
        isInArray(eb, "notifications_email.establishment_siret", sirets),
      )
      .where(
        "notifications_email.email_kind",
        "=",
        "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
      )
      .where("notifications_email.created_at", ">", suggestedSince)
      .select("notifications_email.establishment_siret")
      .distinct()
      .execute();

    return rows
      .map((r) => r.establishment_siret)
      .filter((siret): siret is SiretDto => siret !== null);
  }
}

const getSmsNotificationBuilder = (transaction: KyselyDb) =>
  transaction.selectFrom("notifications_sms").select((eb) =>
    sql<SmsNotification>`(${jsonBuildObject({
      id: eb.ref("id"),
      kind: sql<"sms">`'sms'`,
      createdAt: sql<string>`TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      followedIds: jsonStripNulls(
        jsonBuildObject({
          conventionId: eb.ref("convention_id"),
          establishmentId: eb.ref("establishment_siret"),
          agencyId: eb.ref("agency_id"),
          userId: eb.ref("user_id"),
        }),
      ),
      templatedContent: jsonBuildObject({
        kind: eb.ref("sms_kind"),
        recipientPhone: eb.ref("recipient_phone"),
        params: eb.ref("params"),
      }).$castTo<TemplatedSms>(),
    })}::jsonb || COALESCE(${jsonStripNulls(jsonBuildObject({ state: eb.ref("state") }))}::jsonb, '{}'::jsonb))`.as(
      "notif",
    ),
  );

const getEmailsNotificationBuilder = (transaction: KyselyDb) =>
  transaction
    .selectFrom("notifications_email as e")
    .innerJoin(
      "notifications_email_recipients as r",
      "r.notifications_email_id",
      "e.id",
    )
    .leftJoin(
      "notifications_email_attachments as a",
      "a.notifications_email_id",
      "e.id",
    )
    .groupBy("e.id")
    .select(({ ref, eb }) =>
      sql<EmailNotification>`(${jsonBuildObject({
        id: ref("e.id"),
        kind: sql<"email">`'email'`,
        createdAt: sql<string>`TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        followedIds: jsonStripNulls(
          jsonBuildObject({
            conventionId: ref("convention_id"),
            establishmentId: ref("establishment_siret"),
            agencyId: ref("agency_id"),
            userId: ref("user_id"),
          }),
        ),
        templatedContent: jsonBuildObject({
          kind: ref("email_kind"),
          replyTo: eb
            .case()
            .when(ref("reply_to_email"), "is", null)
            .then(null)
            .else(
              jsonBuildObject({
                name: ref("reply_to_name"),
                email: ref("reply_to_email"),
              }),
            )
            .end(),
          recipients: sql`ARRAY_REMOVE(ARRAY_AGG(CASE WHEN r.recipient_type = 'to' THEN r.email ELSE NULL END), NULL)`,
          cc: sql`ARRAY_REMOVE(ARRAY_AGG(CASE WHEN r.recipient_type = 'cc' THEN r.email ELSE NULL END), NULL)`,
          params: ref("params").$castTo<any>(),
          sender: eb
            .case()
            .when(ref("sender_email"), "is", null)
            .then(null)
            .else(
              jsonBuildObject({
                name: ref("sender_name"),
                email: ref("sender_email"),
              }),
            )
            .end(),
          attachments: sql`CASE
                WHEN ARRAY_REMOVE(ARRAY_AGG(DISTINCT a.attachment), NULL) = ARRAY[]::jsonb[]
                  THEN NULL
                ELSE ARRAY_REMOVE(ARRAY_AGG(DISTINCT a.attachment), NULL)
              END`,
        }).$castTo<TemplatedEmail>(),
      })}::jsonb || COALESCE(${jsonStripNulls(jsonBuildObject({ state: ref("e.state") }))}::jsonb, '{}'::jsonb))`.as(
        "notif",
      ),
    );

const dedupRecipientsAndCc = (
  emailNotification: EmailNotification,
): EmailNotification => {
  const recipients = uniq(emailNotification.templatedContent.recipients);
  return {
    ...emailNotification,
    templatedContent: {
      ...emailNotification.templatedContent,
      recipients,
      cc: uniq(emailNotification.templatedContent.cc ?? []).filter(
        (ccEmail) => !recipients.includes(ccEmail),
      ),
    },
  };
};
