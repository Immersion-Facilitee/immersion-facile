import {
  addMilliseconds,
  subDays,
  subHours,
  subMilliseconds,
  subYears,
} from "date-fns";
import type { Pool } from "pg";
import {
  type ConventionId,
  type EmailAttachment,
  type EmailNotification,
  expectArraysToEqual,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFail,
  expectToEqual,
  type Notification,
  type NotificationErrored,
  type NotificationState,
  type SmsNotification,
  type TemplatedSms,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { PgNotificationRepository } from "./PgNotificationRepository";

describe("PgNotificationRepository", () => {
  const sender = {
    email: "recette@immersion-facile.beta.gouv.fr",
    name: "Recette Immersion Facile",
  };
  const agencyId = "aaaaaaaa-aaaa-4000-aaaa-aaaaaaaaaaaa";
  const now = new Date();
  const emailNotifications: EmailNotification[] = [
    {
      kind: "email",
      id: "11111111-1111-4000-1111-111111111111",
      createdAt: subHours(now, 2).toISOString(),
      followedIds: { agencyId },
      templatedContent: {
        replyTo: { email: "yolo@mail.com", name: "Yolo" },
        kind: "AGENCY_WAS_ACTIVATED",
        recipients: ["bob@mail.com"],
        cc: [],
        params: {
          agencyName: "My agency",
          agencyLogoUrl: "http://logo.com",
          refersToOtherAgency: false,
          agencyReferdToName: undefined,
          agencyDashboardUrl:
            "https://immersion-facile.beta.gouv.fr/tableau-de-bord-agence/dashboard",
        },
        attachments: [
          {
            name: "myFile.pdf",
            content: "myFile content as base64",
          },
        ],
      },
    },
    {
      kind: "email",
      id: "22222222-2222-4000-2222-222222222222",
      createdAt: subHours(now, 3).toISOString(),
      followedIds: { agencyId },
      templatedContent: {
        kind: "TEST_EMAIL",
        recipients: ["lulu@mail.com"],
        cc: ["bob@mail.com"],
        params: {
          url: "https://google.com",
          input1: "test input 1",
          input2: "test input 2",
        },
        attachments: [
          {
            url: "http://my-file.com",
          },
        ],
      },
    },
    {
      kind: "email",
      id: "33333333-3333-4000-3333-333333333333",
      createdAt: now.toISOString(),
      followedIds: { agencyId },
      templatedContent: {
        kind: "AGENCY_LAST_REMINDER",
        recipients: ["yo@remind.com"],
        cc: ["yala@jo.com"],
        params: {
          agencyReferentName: "Agency Referent Name",
          conventionId: "",
          manageConventionLink: "",
          beneficiaryFirstName: "Bob",
          beneficiaryLastName: "L'éponge",
          businessName: "Essuie-tout",
        },
        attachments: undefined,
      },
    },
  ];

  const sms: TemplatedSms = {
    kind: "ReminderForSignatories",
    recipientPhone: "33610101010",
    params: { shortLink: "https://short.link" },
  };
  const smsNotificationId = "11111111-1111-4111-1111-111111111111";
  const smsNotification: Notification = {
    id: smsNotificationId,
    kind: "sms",
    createdAt: new Date("2023-01-01").toISOString(),
    followedIds: { conventionId: "cccccccc-1111-4111-1111-cccccccccccc" },
    templatedContent: sms,
  };

  const emailNotificationsReOrderedByDate = [
    emailNotifications[2],
    emailNotifications[0],
    emailNotifications[1],
  ];

  const maxRetrievedNotifications = 2;

  const withToBeSendState: { state: NotificationState } = {
    state: {
      status: "to-be-send",
      occurredAt: expect.any(String),
    },
  };

  const addWithToBeSentState = <T extends Notification>(
    notification: T,
  ): T => ({
    ...notification,
    ...withToBeSendState,
  });

  let pool: Pool;
  let db: KyselyDb;
  let pgNotificationRepository: PgNotificationRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    pgNotificationRepository = new PgNotificationRepository(
      db,
      maxRetrievedNotifications,
    );

    await db.deleteFrom("notifications_sms").executeTakeFirst();
    await db.deleteFrom("notifications_email_recipients").executeTakeFirst();
    await db.deleteFrom("notifications_email_attachments").executeTakeFirst();
    await db.deleteFrom("notifications_email").executeTakeFirst();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("deleteOldestNotifications", () => {
    const now = new Date();
    const oneYearAgo = subYears(now, 1);
    const twoYearsAgo = subYears(now, 2);

    const makeEmailAndSmsNotifications = (createdAt: Date): Notification[] => [
      {
        createdAt: createdAt.toISOString(),
        followedIds: {
          agencyId: uuid(),
          conventionId: uuid(),
          establishmentSiret: "12345678901234",
          userId: uuid(),
        },
        id: uuid(),
        kind: "email",
        templatedContent: {
          kind: "TEST_EMAIL",
          params: { input1: "sdfsfd", input2: "sfdsfsdf", url: "http://" },
          recipients: ["mail1@mail.com", "mail2@mail.com"],
          attachments: [
            { content: "dsfsdfsdfsdfsdfdfs", name: "sfsdfsdf", url: "http://" },
          ],
          cc: ["mail3@mail.com", "mail4@mail.com"],
          replyTo: { email: "mail@mail.com", name: "sfsdfsdfs" },
          sender: {
            email: "sender@mail.com",
            name: "dsùfjsdf",
          },
        },
      },
      {
        createdAt: createdAt.toISOString(),
        followedIds: {
          agencyId: uuid(),
          conventionId: uuid(),
          establishmentSiret: "12345678901234",
          userId: uuid(),
        },
        id: uuid(),
        kind: "sms",
        templatedContent: {
          kind: "HelloWorld",
          params: { testMessage: "dsfsdf:sdnfkjshf" },
          recipientPhone: "+33677884455",
        },
      },
    ];

    const [emailCreatedOneYearMinusOneMSAgo, smsCreatedOneYearMinusOneMSAgo] =
      makeEmailAndSmsNotifications(addMilliseconds(oneYearAgo, 1));
    const [emailCreatedOneYearAgo, smsCreatedOneYearAgo] =
      makeEmailAndSmsNotifications(oneYearAgo);
    const [emailCreatedTwoYearsAgo, smsCreatedTwoYearsAgo] =
      makeEmailAndSmsNotifications(twoYearsAgo);
    const [emailCreatedTwoYearsAndOneMSAgo, smsCreatedTwoYearsAndOneMSAgo] =
      makeEmailAndSmsNotifications(subMilliseconds(twoYearsAgo, 1));

    beforeEach(async () => {
      await pgNotificationRepository.save(emailCreatedOneYearMinusOneMSAgo);
      await pgNotificationRepository.save(emailCreatedTwoYearsAndOneMSAgo);
      await pgNotificationRepository.save(emailCreatedTwoYearsAgo);
      await pgNotificationRepository.save(emailCreatedOneYearAgo);
      await pgNotificationRepository.save(smsCreatedOneYearMinusOneMSAgo);
      await pgNotificationRepository.save(smsCreatedOneYearAgo);
      await pgNotificationRepository.save(smsCreatedTwoYearsAgo);
      await pgNotificationRepository.save(smsCreatedTwoYearsAndOneMSAgo);
    });

    describe("createdAt Param", () => {
      it("when to range param set with one year ago, delete notifications that are created before one year ago", async () => {
        expectToEqual(
          await pgNotificationRepository.deleteOldestNotifications({
            limit: 10,
            createdAt: {
              to: oneYearAgo,
            },
          }),
          6,
        );

        expectArraysToEqualIgnoringOrder(
          (await pgNotificationRepository.test_getAllNotifications()).map(
            ({ id }) => id,
          ),
          [
            emailCreatedOneYearMinusOneMSAgo.id,
            smsCreatedOneYearMinusOneMSAgo.id,
          ],
        );
      });

      it("when to range param set with now, delete all notifications", async () => {
        expectToEqual(
          await pgNotificationRepository.deleteOldestNotifications({
            limit: 10,
            createdAt: {
              to: now,
            },
          }),
          8,
        );

        expectArraysToEqualIgnoringOrder(
          await pgNotificationRepository.test_getAllNotifications(),
          [],
        );
      });
    });

    describe("limit Param", () => {
      it("when limit 1, delete oldest notifications sms by priority", async () => {
        const limit = 1;
        expectToEqual(
          await pgNotificationRepository.deleteOldestNotifications({
            limit: limit,
            createdAt: {
              to: now,
            },
          }),
          limit,
        );

        expectArraysToEqualIgnoringOrder(
          (await pgNotificationRepository.test_getAllNotifications()).map(
            ({ id }) => id,
          ),
          [
            emailCreatedOneYearMinusOneMSAgo.id,
            smsCreatedOneYearMinusOneMSAgo.id,
            emailCreatedOneYearAgo.id,
            smsCreatedOneYearAgo.id,
            emailCreatedTwoYearsAgo.id,
            smsCreatedTwoYearsAgo.id,
            emailCreatedTwoYearsAndOneMSAgo.id,
          ],
        );
      });

      it("when limit 4, delete 4 oldest notifications", async () => {
        const limit = 4;
        expectToEqual(
          await pgNotificationRepository.deleteOldestNotifications({
            limit: limit,
            createdAt: {
              to: now,
            },
          }),
          limit,
        );

        expectArraysToEqualIgnoringOrder(
          (await pgNotificationRepository.test_getAllNotifications()).map(
            ({ id }) => id,
          ),
          [
            emailCreatedOneYearMinusOneMSAgo.id,
            smsCreatedOneYearMinusOneMSAgo.id,
            emailCreatedOneYearAgo.id,
            smsCreatedOneYearAgo.id,
          ],
        );
      });
    });
  });

  describe("save", () => {
    it("saves Sms notification in a dedicated table, then gets it", async () => {
      await pgNotificationRepository.save(smsNotification);

      const response = await pgNotificationRepository.getByIdAndKind(
        smsNotificationId,
        "sms",
      );
      expectToEqual(response, { ...smsNotification, ...withToBeSendState });
    });

    it("saves Email notification in a dedicated table, then gets it", async () => {
      const emailNotification = createTemplatedEmailNotification({
        recipients: ["bob@mail.com", "jane@mail.com"],
        cc: ["copy@mail.com"],
        sender,
      });

      await pgNotificationRepository.save(emailNotification);

      const response = await pgNotificationRepository.getByIdAndKind(
        emailNotification.id,
        "email",
      );
      expectToEqual(response, { ...emailNotification, ...withToBeSendState });
    });

    it("save and eliminates duplicates when they exit", async () => {
      const recipients = ["bob@mail.com", "jane@mail.com", "bob@mail.com"];
      const cc = ["copy@mail.com", "jane@mail.com"];
      const emailNotification = createTemplatedEmailNotification({
        recipients,
        cc,
        sender,
      });

      await pgNotificationRepository.save(emailNotification);

      const response = await pgNotificationRepository.getByIdAndKind(
        emailNotification.id,
        "email",
      );
      expectToEqual(response, {
        ...emailNotification,
        templatedContent: {
          ...emailNotification.templatedContent,
          recipients: ["bob@mail.com", "jane@mail.com"],
          cc: ["copy@mail.com"],
        },
        ...withToBeSendState,
      });
    });

    it("round-trips followedIds.userId on email and sms notifications", async () => {
      const userId = "dddddddd-1111-4111-1111-dddddddddddd";

      const emailNotification = createTemplatedEmailNotification({
        recipients: ["user@mail.com"],
        sender,
      });
      const emailWithUserId: EmailNotification = {
        ...emailNotification,
        followedIds: { ...emailNotification.followedIds, userId },
      };

      const smsWithUserId: SmsNotification = {
        ...smsNotification,
        followedIds: { ...smsNotification.followedIds, userId },
      };

      await pgNotificationRepository.save(emailWithUserId);
      await pgNotificationRepository.save(smsWithUserId);

      expectToEqual(
        await pgNotificationRepository.getByIdAndKind(
          emailNotification.id,
          "email",
        ),
        {
          ...emailWithUserId,
          templatedContent: {
            ...emailWithUserId.templatedContent,
            cc: [],
          },
          ...withToBeSendState,
        },
      );
      expectToEqual(
        await pgNotificationRepository.getByIdAndKind(smsNotificationId, "sms"),
        { ...smsWithUserId, ...withToBeSendState },
      );
    });

    it("save and eliminates duplicates when cc ends up empty after de-duplication", async () => {
      const emailNotification = createTemplatedEmailNotification({
        recipients: ["bob@mail.com"],
        cc: ["bob@mail.com"],
        sender,
      });

      await pgNotificationRepository.save(emailNotification);

      const response = await pgNotificationRepository.getByIdAndKind(
        emailNotification.id,
        "email",
      );
      expectToEqual(response, {
        ...emailNotification,
        templatedContent: {
          ...emailNotification.templatedContent,
          recipients: ["bob@mail.com"],
          cc: [],
        },
        ...withToBeSendState,
      });
    });

    it("throws when email notification has no recipients & cc", async () => {
      const emailNotification = createTemplatedEmailNotification({
        recipients: [],
        cc: [],
        sender,
      });

      await expectPromiseToFail(
        pgNotificationRepository.save(emailNotification),
      );
    });
  });

  describe("saveBatch", () => {
    it("saves a batch of notifications email and sms", async () => {
      await pgNotificationRepository.saveBatch([
        ...emailNotifications,
        smsNotification,
      ]);

      const response = await pgNotificationRepository.getEmailsByFilters({});

      expectToEqual(
        response,
        emailNotificationsReOrderedByDate
          .slice(0, maxRetrievedNotifications)
          .map(addWithToBeSentState),
      );

      const smsResponse = await pgNotificationRepository.getByIdAndKind(
        smsNotificationId,
        "sms",
      );
      expectToEqual(smsResponse, { ...smsNotification, ...withToBeSendState });
    });

    it("saves a batch of notifications sms only", async () => {
      await pgNotificationRepository.saveBatch([smsNotification]);

      const response = await pgNotificationRepository.getEmailsByFilters({});
      expectArraysToEqual(response, []);

      const smsResponse = await pgNotificationRepository.getByIdAndKind(
        smsNotificationId,
        "sms",
      );
      expectToEqual(smsResponse, { ...smsNotification, ...withToBeSendState });
    });
  });

  describe("markErrored", () => {
    it("should mark the notification as errored, and drop it when null is passed", async () => {
      const notification = emailNotifications[0];

      await pgNotificationRepository.save(notification);

      const notificationState: NotificationErrored = {
        status: "errored",
        httpStatus: 400,
        message: "error",
        occurredAt: new Date().toISOString(),
      };

      await pgNotificationRepository.updateState({
        notificationId: notification.id,
        notificationKind: notification.kind,
        state: notificationState,
      });

      expectToEqual(
        await pgNotificationRepository.getByIdAndKind(notification.id, "email"),
        { ...notification, state: notificationState },
      );

      await pgNotificationRepository.updateState({
        notificationId: notification.id,
        notificationKind: notification.kind,
        state: undefined,
      });

      expectToEqual(
        await pgNotificationRepository.getByIdAndKind(notification.id, "email"),
        { ...notification, state: undefined },
      );
    });
  });

  describe("getEmailsByFilters", () => {
    beforeEach(async () => {
      await Promise.all(
        emailNotifications.map((notif) => pgNotificationRepository.save(notif)),
      );
    });

    it("without filters returns all emails", async () => {
      const response = await pgNotificationRepository.getEmailsByFilters({});
      expectToEqual(
        response,
        emailNotificationsReOrderedByDate
          .slice(0, maxRetrievedNotifications)
          .map(addWithToBeSentState),
      );
    });

    describe("with filters", () => {
      it("returns matching email when required filters match", async () => {
        const emailNotification = emailNotifications[0];
        const response = await pgNotificationRepository.getEmailsByFilters({
          email: emailNotification.templatedContent.recipients[0],
          emailType: emailNotification.templatedContent.kind,
        });
        expectToEqual(response, [
          { ...emailNotification, ...withToBeSendState },
        ]);
      });

      it("returns matching email when required filters + conventionId match", async () => {
        const emailNotification: EmailNotification = {
          createdAt: new Date().toISOString(),
          followedIds: { conventionId: "cccccccc-1111-4111-1111-cccccccccccc" },
          id: "11111111-1111-4444-1111-111111111111",
          kind: "email",
          templatedContent: {
            kind: "CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION",
            recipients: ["bob@mail.com"],
            sender: {
              email: "fake-email@email.com",
              name: "Fake name",
            },
            cc: [],
            params: {
              beneficiaryFirstName: "Bob",
              beneficiaryLastName: "L'éponge",
              beneficiaryEmail: "bob@mail.com",
              conventionId: "cccccccc-1111-4111-1111-cccccccccccc",
              beneficiaryPhone: "0606060606",
              previousAgencyName: "Agence du Grand Est",
              internshipKind: "immersion",
              justification: "Justification",
              manageConventionLink: "https://magic-link.com",
            },
          },
        };
        await pgNotificationRepository.save(emailNotification);

        const response = await pgNotificationRepository.getEmailsByFilters({
          email: emailNotification.templatedContent.recipients[0],
          emailType: emailNotification.templatedContent.kind,
          conventionId: emailNotification.followedIds.conventionId,
        });

        expectToEqual(response, [
          { ...emailNotification, ...withToBeSendState },
        ]);
      });

      it("returns matching email when required filters + aroundCreatedAt match", async () => {
        const today = new Date();
        const oldEmailNotification: EmailNotification = {
          createdAt: subDays(today, 15).toISOString(),
          followedIds: { conventionId: "cccccccc-1111-4111-1111-cccccccccccc" },
          id: "11111111-1111-4444-1111-111111111111",
          kind: "email",
          templatedContent: {
            kind: "CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION",
            recipients: ["bob@mail.com"],
            sender: {
              email: "fake-email@email.com",
              name: "Fake name",
            },
            cc: [],
            params: {
              beneficiaryFirstName: "Bob",
              beneficiaryLastName: "L'éponge",
              beneficiaryEmail: "bob@mail.com",
              conventionId: "cccccccc-1111-4111-1111-cccccccccccc",
              beneficiaryPhone: "0606060606",
              previousAgencyName: "Agence du Grand Est",
              internshipKind: "immersion",
              justification: "Justification",
              manageConventionLink: "https://magic-link.com",
            },
          },
        };
        const emailNotification: EmailNotification = {
          createdAt: today.toISOString(),
          followedIds: { conventionId: "cccccccc-1111-4111-1111-cccccccccccd" },
          id: "11111111-1111-4444-1111-111111111112",
          kind: "email",
          templatedContent: {
            kind: "CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION",
            recipients: ["bob@mail.com"],
            sender: {
              email: "fake-email@email.com",
              name: "Fake name",
            },
            cc: [],
            params: {
              beneficiaryFirstName: "Bob",
              beneficiaryLastName: "L'éponge",
              beneficiaryEmail: "bob@mail.com",
              conventionId: "cccccccc-1111-4111-1111-cccccccccccc",
              beneficiaryPhone: "0606060606",
              previousAgencyName: "Agence du Grand Est",
              internshipKind: "immersion",
              justification: "Justification",
              manageConventionLink: "https://magic-link.com",
            },
          },
        };
        await pgNotificationRepository.saveBatch([
          oldEmailNotification,
          emailNotification,
        ]);

        const response = await pgNotificationRepository.getEmailsByFilters({
          email: emailNotification.templatedContent.recipients[0],
          emailType: emailNotification.templatedContent.kind,
          createdAt: today,
        });

        expectToEqual(response, [
          { ...emailNotification, ...withToBeSendState },
        ]);
      });

      it("returns empty array when no match found", async () => {
        const response = await pgNotificationRepository.getEmailsByFilters({
          email: "fake-email@email.com",
          emailType: emailNotifications[0].templatedContent.kind,
        });
        expectToEqual(response, []);
      });

      describe("pagination with offset and limit", () => {
        it("returns first batch when no offset is provided", async () => {
          const response = await pgNotificationRepository.getEmailsByFilters({
            limit: 2,
          });
          expectToEqual(
            response,
            emailNotificationsReOrderedByDate
              .slice(0, 2)
              .map(addWithToBeSentState),
          );
        });

        it("returns second batch when offset is provided", async () => {
          const response = await pgNotificationRepository.getEmailsByFilters({
            offset: 2,
            limit: 2,
          });
          expectToEqual(
            response,
            emailNotificationsReOrderedByDate
              .slice(2, 4)
              .map(addWithToBeSentState),
          );
        });

        it("returns empty array when offset exceeds total count", async () => {
          const response = await pgNotificationRepository.getEmailsByFilters({
            offset: 100,
            limit: 10,
          });
          expectToEqual(response, []);
        });

        it("paginates correctly with createdAt filter", async () => {
          const threeDaysAgo = subDays(new Date(), 3);
          const emailNotificationToday: EmailNotification = {
            createdAt: threeDaysAgo.toISOString(),
            followedIds: { agencyId },
            id: "44444444-4444-4000-4444-444444444444",
            kind: "email",
            templatedContent: {
              kind: "TEST_EMAIL",
              recipients: ["today@mail.com"],
              cc: [],
              params: {
                url: "https://google.com",
                input1: "test input 1",
                input2: "test input 2",
              },
            },
          };
          const emailNotificationYesterday: EmailNotification = {
            createdAt: subDays(threeDaysAgo, 1).toISOString(),
            followedIds: { agencyId },
            id: "55555555-5555-4000-5555-555555555555",
            kind: "email",
            templatedContent: {
              kind: "TEST_EMAIL",
              recipients: ["yesterday@mail.com"],
              cc: [],
              params: {
                url: "https://google.com",
                input1: "test input 1",
                input2: "test input 2",
              },
            },
          };
          await pgNotificationRepository.saveBatch([
            emailNotificationToday,
            emailNotificationYesterday,
          ]);

          const firstPage = await pgNotificationRepository.getEmailsByFilters({
            createdAt: threeDaysAgo,
            offset: 0,
            limit: 1,
          });
          expectToEqual(firstPage, [
            { ...emailNotificationToday, ...withToBeSendState },
          ]);

          const secondPage = await pgNotificationRepository.getEmailsByFilters({
            createdAt: threeDaysAgo,
            offset: 1,
            limit: 1,
          });
          expectToEqual(secondPage, []);
        });
      });
    });
  });

  describe("getEmailsByIds", () => {
    it("returns [] when no ids are provided", async () => {
      const response = await pgNotificationRepository.getEmailsByIds([]);
      expectToEqual(response, []);
    });

    it("returns the emails notifications with the provided ids", async () => {
      await Promise.all(
        emailNotifications.map((notif) => pgNotificationRepository.save(notif)),
      );
      const response = await pgNotificationRepository.getEmailsByIds([
        emailNotifications[0].id,
        emailNotifications[1].id,
      ]);
      expectToEqual(response, [
        { ...emailNotifications[0], ...withToBeSendState },
        { ...emailNotifications[1], ...withToBeSendState },
      ]);
    });
  });

  describe("getSmsByIds", () => {
    it("returns [] when no ids are provided", async () => {
      const response = await pgNotificationRepository.getSmsByIds([]);
      expectToEqual(response, []);
    });

    it("returns the sms notifications with the provided ids", async () => {
      await pgNotificationRepository.save(smsNotification);
      const response = await pgNotificationRepository.getSmsByIds([
        smsNotification.id,
      ]);
      expectToEqual(response, [{ ...smsNotification, ...withToBeSendState }]);
    });
  });

  describe("getLatestNotifications", () => {
    it("gets the last notifications of each kind, up to the provided maximum", async () => {
      const smsNotifications: SmsNotification[] = [
        {
          kind: "sms",
          id: "77777777-7777-4000-7777-777777777777",
          createdAt: subHours(new Date(), 4).toISOString(),
          templatedContent: {
            kind: "ReminderForSignatories",
            recipientPhone: "33610101010",
            params: { shortLink: "https://short.com" },
          },
          followedIds: {},
        },
      ];

      await Promise.all(
        [...emailNotifications, ...smsNotifications].map((notif) =>
          pgNotificationRepository.save(notif),
        ),
      );

      const notifications =
        await pgNotificationRepository.getLastNotifications();
      expectToEqual(notifications, {
        emails: emailNotificationsReOrderedByDate
          .slice(0, maxRetrievedNotifications)
          .map(addWithToBeSentState),
        sms: smsNotifications.map(addWithToBeSentState),
      });
    });
  });

  describe("deleteAllAttachements", () => {
    it("remove all the attachment content, but keeps the metadata (attachement exited, name of file)", async () => {
      const emailNotification = createTemplatedEmailNotification({
        recipients: ["bob@mail.com"],
        sender,
        cc: [],
        attachments: [
          { name: "myFile.pdf", content: "myFile content as base64" },
        ],
      });

      await pgNotificationRepository.save(emailNotification);

      const emailNotificationWithUrlAttachment =
        createTemplatedEmailNotification({
          id: "33333333-3333-4444-3333-333333333333",
          recipients: ["bob@mail.com"],
          sender,
          cc: [],
          attachments: [{ url: "www.truc.com" }],
        });

      await pgNotificationRepository.save(emailNotificationWithUrlAttachment);

      const numberOfUpdatedRows =
        await pgNotificationRepository.deleteAllEmailAttachements();

      expect(numberOfUpdatedRows).toBe(1);

      expectToEqual(await pgNotificationRepository.getLastNotifications(), {
        sms: [],
        emails: [
          emailNotificationWithUrlAttachment,
          {
            ...emailNotification,
            templatedContent: {
              ...emailNotification.templatedContent,
              attachments: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  ...emailNotification.templatedContent.attachments![0],
                  content: "deleted-content",
                },
              ],
            },
          },
        ].map(addWithToBeSentState),
      });
    });
  });

  describe("getLastSmsNotificationByFilter", () => {
    const smsKind = "ReminderForSignatories";
    const recipientPhone = "+33610101010";
    const conventionId: ConventionId = "88888888-4444-4000-4444-111111111111";

    it("get the latest sms for a phoneNumber, given conventionId and smsKind", async () => {
      const lastSmsNotification: SmsNotification = {
        kind: "sms",
        id: "77777777-7777-4000-7777-777777777777",
        createdAt: subHours(new Date(), 4).toISOString(),
        templatedContent: {
          kind: smsKind,
          recipientPhone,
          params: { shortLink: "https://short.com" },
        },
        followedIds: {
          conventionId: conventionId,
        },
      };
      const olderSmsNotification: SmsNotification = {
        kind: "sms",
        id: "77777777-7777-4000-7777-777777778888",
        createdAt: subDays(new Date(), 5).toISOString(),
        templatedContent: {
          kind: smsKind,
          recipientPhone,
          params: { shortLink: "https://short.com" },
        },
        followedIds: {
          conventionId: conventionId,
        },
      };

      await pgNotificationRepository.saveBatch([
        lastSmsNotification,
        olderSmsNotification,
      ]);

      expectToEqual(
        await pgNotificationRepository.getLastSmsNotificationByFilter({
          conventionId,
          smsKind,
          recipientPhoneNumber: recipientPhone,
        }),
        { ...lastSmsNotification, ...withToBeSendState },
      );
    });

    it("Return undefined if no sms notification found", async () => {
      const lastNotification =
        await pgNotificationRepository.getLastSmsNotificationByFilter({
          conventionId,
          smsKind,
          recipientPhoneNumber: recipientPhone,
        });

      expect(lastNotification).toBeUndefined();
    });
  });

  describe("filterUserDeletionWarningNotifications", () => {
    const referenceDate = new Date("2026-01-15T10:00:00.000Z");
    const userA = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    const userC = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
    const userD = "dddddddd-dddd-4ddd-dddd-dddddddddddd";

    const insertDeletionWarning = async ({
      userId,
      createdAt,
    }: {
      userId: string;
      createdAt: Date;
    }) =>
      db
        .insertInto("notifications_email")
        .values({
          id: uuid(),
          email_kind: "ACCOUNT_DELETION_WARNING",
          user_id: userId,
          created_at: createdAt.toISOString(),
        })
        .execute();

    it("returns [] without querying when userIds is empty", async () => {
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 3),
      });

      const result =
        await pgNotificationRepository.filterUserDeletionWarningNotifications({
          userIds: [],
          excludeWarnedSince: subDays(referenceDate, 10),
        });

      expectToEqual(result, []);
    });

    it("returns distinct user ids warned at or after excludeWarnedSince", async () => {
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 3),
      });
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 5),
      });
      await insertDeletionWarning({
        userId: userB,
        createdAt: subDays(referenceDate, 20),
      });

      const result =
        await pgNotificationRepository.filterUserDeletionWarningNotifications({
          userIds: [userA, userB, userC],
          excludeWarnedSince: subDays(referenceDate, 10),
        });

      expectArraysToEqualIgnoringOrder(result, [userA]);
    });

    it("returns distinct user ids warned inside onlyWarnedBetween", async () => {
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 8),
      });
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 9),
      });
      await insertDeletionWarning({
        userId: userB,
        createdAt: subDays(referenceDate, 6),
      });
      await insertDeletionWarning({
        userId: userC,
        createdAt: subDays(referenceDate, 11),
      });

      const result =
        await pgNotificationRepository.filterUserDeletionWarningNotifications({
          userIds: [userA, userB, userC, userD],
          onlyWarnedBetween: {
            from: subDays(referenceDate, 10),
            to: subDays(referenceDate, 7),
          },
        });

      expectArraysToEqualIgnoringOrder(result, [userA]);
    });

    it("ignores users whose warnings exist but who are not in the input userIds", async () => {
      await insertDeletionWarning({
        userId: userA,
        createdAt: subDays(referenceDate, 3),
      });
      await insertDeletionWarning({
        userId: userB,
        createdAt: subDays(referenceDate, 3),
      });

      const result =
        await pgNotificationRepository.filterUserDeletionWarningNotifications({
          userIds: [userA],
          excludeWarnedSince: subDays(referenceDate, 10),
        });

      expectArraysToEqualIgnoringOrder(result, [userA]);
    });

    it("ignores notifications with a different email_kind", async () => {
      await db
        .insertInto("notifications_email")
        .values({
          id: uuid(),
          email_kind: "TEST_EMAIL",
          user_id: userA,
          created_at: subDays(referenceDate, 3).toISOString(),
        })
        .execute();

      const result =
        await pgNotificationRepository.filterUserDeletionWarningNotifications({
          userIds: [userA],
          excludeWarnedSince: subDays(referenceDate, 10),
        });

      expectToEqual(result, []);
    });
  });

  describe("filterEstablishmentSiretsAlreadySuggestedReengagement", () => {
    const referenceDate = new Date("2026-01-15T10:00:00.000Z");
    const siretA = "11110000111100";
    const siretB = "22220000222200";
    const siretC = "33330000333300";

    const insertReengagementSuggestion = async ({
      siret,
      createdAt,
    }: {
      siret: string;
      createdAt: Date;
    }) =>
      db
        .insertInto("notifications_email")
        .values({
          id: uuid(),
          email_kind: "ESTABLISHMENT_REENGAGEMENT_SUGGESTION",
          establishment_siret: siret,
          created_at: createdAt.toISOString(),
        })
        .execute();

    it("returns empty array when sirets is empty", async () => {
      await insertReengagementSuggestion({
        siret: siretA,
        createdAt: subDays(referenceDate, 3),
      });

      const result =
        await pgNotificationRepository.filterEstablishmentSiretsAlreadySuggestedReengagement(
          { sirets: [], suggestedSince: subDays(referenceDate, 10) },
        );

      expectToEqual(result, []);
    });

    it("returns only sirets that have been suggested after suggestedSince", async () => {
      await insertReengagementSuggestion({
        siret: siretA,
        createdAt: subDays(referenceDate, 3),
      });
      await insertReengagementSuggestion({
        siret: siretB,
        createdAt: subDays(referenceDate, 5),
      });
      await insertReengagementSuggestion({
        siret: siretC,
        createdAt: subDays(referenceDate, 20),
      });

      const result =
        await pgNotificationRepository.filterEstablishmentSiretsAlreadySuggestedReengagement(
          {
            sirets: [siretA, siretB, siretC],
            suggestedSince: subDays(referenceDate, 10),
          },
        );

      expectArraysToEqualIgnoringOrder(result, [siretA, siretB]);
    });

    it("ignores sirets whose suggestion exists but who are not in the input sirets", async () => {
      await insertReengagementSuggestion({
        siret: siretA,
        createdAt: subDays(referenceDate, 3),
      });
      await insertReengagementSuggestion({
        siret: siretB,
        createdAt: subDays(referenceDate, 3),
      });

      const result =
        await pgNotificationRepository.filterEstablishmentSiretsAlreadySuggestedReengagement(
          { sirets: [siretA], suggestedSince: subDays(referenceDate, 10) },
        );

      expectArraysToEqualIgnoringOrder(result, [siretA]);
    });

    it("ignores notifications with a different email_kind", async () => {
      await db
        .insertInto("notifications_email")
        .values({
          id: uuid(),
          email_kind: "TEST_EMAIL",
          establishment_siret: siretA,
          created_at: subDays(referenceDate, 3).toISOString(),
        })
        .execute();

      const result =
        await pgNotificationRepository.filterEstablishmentSiretsAlreadySuggestedReengagement(
          { sirets: [siretA], suggestedSince: subDays(referenceDate, 10) },
        );

      expectToEqual(result, []);
    });
  });
});

const createTemplatedEmailNotification = ({
  recipients,
  cc,
  sender,
  attachments,
  id,
}: {
  recipients: string[];
  cc?: string[];
  sender: {
    email: string;
    name: string;
  };
  attachments?: EmailAttachment[];
  id?: string;
}): EmailNotification => {
  const emailNotification: Notification = {
    id: id ?? "22222222-2222-4444-2222-222222222222",
    kind: "email",
    createdAt: subHours(new Date(), 1).toISOString(),
    followedIds: { agencyId: "cccccccc-1111-4111-1111-cccccccccccc" },
    templatedContent: {
      kind: "AGENCY_WAS_REJECTED",
      recipients,
      sender,
      cc,
      params: {
        agencyName: "My agency",
        statusJustification: "Justification",
      },
      ...(attachments ? { attachments } : {}),
    },
  };

  return emailNotification;
};
