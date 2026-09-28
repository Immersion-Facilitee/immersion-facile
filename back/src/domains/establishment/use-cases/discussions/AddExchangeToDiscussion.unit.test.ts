import {
  type AbsoluteUrl,
  type BrevoInboundBody,
  ConnectedUserBuilder,
  DiscussionBuilder,
  type DiscussionExchangeForbiddenParams,
  type Exchange,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  type UserId,
} from "shared";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeCreateNewEvent } from "../../../core/events/ports/EventBus";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  type AddExchangeToDiscussion,
  makeAddExchangeToDiscussion,
} from "./AddExchangeToDiscussion";

describe("AddExchangeToDiscussion", () => {
  const replyDomain = "reply.my-domain.com";

  const adminUserEstablishment1Builder = new ConnectedUserBuilder()
    .withId("estab1-admin")
    .withEmail("estab1-admin@mail.com");
  const adminUserEstablishment2Builder = new ConnectedUserBuilder()
    .withId("estab2-admin")
    .withEmail("estab2-admin@mail.com");

  const adminConnectedUserEstablishment1 =
    adminUserEstablishment1Builder.build();
  const adminUserEstablishment1 = adminUserEstablishment1Builder.buildUser();

  const adminConnectedUserEstablishment2 =
    adminUserEstablishment2Builder.build();
  const adminUserEstablishment2 = adminUserEstablishment2Builder.buildUser();

  const contactUserEstablishment1 = new ConnectedUserBuilder()
    .withId("estab1-contact")
    .withEmail("estab1-contact@mail.com")
    .buildUser();

  const contactUserEstablishment2 = new ConnectedUserBuilder()
    .withId("estab2-contact")
    .withEmail("estab2-contact@mail.com")
    .buildUser();

  const establishment1 = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000000")
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "boss",
        phone: "+33655885588",
        userId: adminUserEstablishment1.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
      {
        role: "establishment-contact",
        status: "ACCEPTED",
        userId: contactUserEstablishment1.id,
        shouldReceiveDiscussionNotifications: true,
      },
    ])
    .build();

  const establishment2 = new EstablishmentAggregateBuilder()
    .withEstablishmentSiret("00000000000001")
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "boss",
        phone: "+33655885588",
        userId: adminUserEstablishment2.id,
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
      },
      {
        role: "establishment-contact",
        status: "ACCEPTED",
        userId: contactUserEstablishment2.id,
        shouldReceiveDiscussionNotifications: true,
      },
    ])
    .build();

  const pendingDiscussion1 = new DiscussionBuilder()
    .withSiret(establishment1.establishment.siret)
    .withAppellationCode("20567")
    .withId("11111111-e89b-12d3-a456-426614174000")
    .withStatus({ status: "PENDING" })
    .withExchanges([
      {
        subject: "Ma discussion 1",
        message: "Hello",
        sender: "potentialBeneficiary",
        sentAt: new Date().toISOString(),
        attachments: [],
      },
    ])
    .build();

  const pendingDiscussion2 = new DiscussionBuilder()
    .withSiret(establishment2.establishment.siret)
    .withAppellationCode("13252")
    .withId("22222222-e89b-12d3-a456-426614174000")
    .withStatus({ status: "PENDING" })
    .withExchanges([
      {
        subject: "",
        message: "Hello",
        sender: "potentialBeneficiary",
        sentAt: new Date().toISOString(),
        attachments: [],
      },
    ])
    .build();

  const potentialBeneficiaryConnectedUser = new ConnectedUserBuilder()
    .withId("potential-beneficiary-user")
    .withEmail(pendingDiscussion1.potentialBeneficiary.email)
    .build();

  let uow: InMemoryUnitOfWork;
  let addExchangeToDiscussion: AddExchangeToDiscussion;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    timeGateway = new CustomTimeGateway();
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    addExchangeToDiscussion = makeAddExchangeToDiscussion({
      deps: {
        createNewEvent: makeCreateNewEvent({
          uuidGenerator: new UuidV4Generator(),
          timeGateway: timeGateway,
        }),
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
        timeGateway,
        immersionFacileBaseUrl:
          "https://www.fake-immersion-facile-base-url.com",
      },
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    uow.discussionRepository.discussions = [
      pendingDiscussion1,
      pendingDiscussion2,
    ];

    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishment1,
      establishment2,
    ];

    uow.userRepository.users = [
      adminUserEstablishment1,
      adminUserEstablishment2,
      contactUserEstablishment1,
      contactUserEstablishment2,
      potentialBeneficiaryConnectedUser,
    ];
  });

  describe("right paths", () => {
    describe("when establishment exist", () => {
      describe("when discussion status is PENDING", () => {
        it("saves the new exchange in the discussion with attachment ref and source inbound-parsing", async () => {
          const [firstInboundParsingItem, secondInboundParsingItem] =
            createInboundParsingResponse([
              `firstname1_lastname1__${pendingDiscussion1.id}_b@${replyDomain}`,
              `firstname2_lastname2__${pendingDiscussion2.id}_e@${replyDomain}`,
            ]).items;

          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  senderEmail: contactUserEstablishment1.email,
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: firstInboundParsingItem.Subject,
                },
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: secondInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion2.id,
                  recipientRole: "establishment",
                  senderEmail: pendingDiscussion2.potentialBeneficiary.email,
                  sentAt: new Date(
                    secondInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    secondInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: secondInboundParsingItem.Subject,
                },
              ],
            },
            undefined,
          );

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...pendingDiscussion1,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...pendingDiscussion1.exchanges,
                {
                  message: (firstInboundParsingItem.RawHtmlBody ?? "").trim(), // zStringMinLength1Max1024 is performing a trim!
                  sender: "establishment",
                  email: contactUserEstablishment1.email,
                  firstname: contactUserEstablishment1.firstName,
                  lastname: contactUserEstablishment1.lastName,
                  sentAt: "2023-06-28T08:06:52.000Z",
                  subject: firstInboundParsingItem.Subject,
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                },
              ],
            },
            {
              ...pendingDiscussion2,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...pendingDiscussion2.exchanges,
                {
                  message: (secondInboundParsingItem.RawHtmlBody ?? "").trim(), // zStringMinLength1Max1024 is performing a trim!
                  sender: "potentialBeneficiary",
                  sentAt: "2023-06-28T08:06:52.000Z",
                  subject: secondInboundParsingItem.Subject,
                  attachments:
                    secondInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                },
              ],
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ExchangeAddedToDiscussion",
              payload: {
                discussionId: pendingDiscussion1.id,
                siret: pendingDiscussion1.siret,
              },
            },
            {
              topic: "ExchangeAddedToDiscussion",
              payload: {
                discussionId: pendingDiscussion2.id,
                siret: pendingDiscussion2.siret,
              },
            },
          ]);
        });

        it("saves the new exchange in the discussion with attachment ref and source dashboard", async () => {
          await addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment1,
          );

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...pendingDiscussion1,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...pendingDiscussion1.exchanges,
                {
                  message: "Hello",
                  sender: "establishment",
                  email: adminConnectedUserEstablishment1.email,
                  firstname: adminConnectedUserEstablishment1.firstName,
                  lastname: adminConnectedUserEstablishment1.lastName,
                  sentAt: "2021-09-01T10:10:00.000Z",
                  subject:
                    "Réponse de My default business name à votre demande d'immersion",
                  attachments: [],
                },
              ],
            },
            pendingDiscussion2,
          ]);
        });

        it("saves the new exchange in the discussion with attachment ref and with a default subject if not provided", async () => {
          const [firstInboundParsingItem, secondInboundParsingItem] =
            createInboundParsingResponse(
              [
                `firstname1_lastname1__${pendingDiscussion1.id}_b@${replyDomain}`,
                `firstname2_lastname2__${pendingDiscussion2.id}_e@${replyDomain}`,
              ],
              "",
            ).items;

          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  senderEmail: contactUserEstablishment1.email,
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: "",
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                },
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: secondInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion2.id,
                  recipientRole: "establishment",
                  senderEmail: pendingDiscussion2.potentialBeneficiary.email,
                  attachments:
                    secondInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: "",
                  sentAt: new Date(
                    secondInboundParsingItem.SentAtDate,
                  ).toISOString(),
                },
              ],
            },
            undefined,
          );

          expectToEqual(uow.discussionRepository.discussions, [
            {
              ...pendingDiscussion1,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...pendingDiscussion1.exchanges,
                {
                  sender: "establishment",
                  email: contactUserEstablishment1.email,
                  firstname: contactUserEstablishment1.firstName,
                  lastname: contactUserEstablishment1.lastName,
                  subject: "Sans objet",
                  message: (firstInboundParsingItem.RawHtmlBody ?? "").trim(),
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                },
              ],
            },
            {
              ...pendingDiscussion2,
              updatedAt: timeGateway.now().toISOString(),
              exchanges: [
                ...pendingDiscussion2.exchanges,
                {
                  sender: "potentialBeneficiary",
                  subject: "Sans objet",
                  sentAt: new Date(
                    secondInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  message: (secondInboundParsingItem.RawHtmlBody ?? "").trim(),
                  attachments:
                    secondInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                },
              ],
            },
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "ExchangeAddedToDiscussion",
              payload: {
                discussionId: pendingDiscussion1.id,
                siret: pendingDiscussion1.siret,
              },
            },
            {
              topic: "ExchangeAddedToDiscussion",
              payload: {
                discussionId: pendingDiscussion2.id,
                siret: pendingDiscussion2.siret,
              },
            },
          ]);
        });

        it("saves the new exchange in the discussion and provides a default sentAt and subject for dashboard", async () => {
          await addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello without sentAt and subject",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment1,
          );

          expectToEqual(uow.discussionRepository.discussions[0].exchanges[1], {
            message: "Hello without sentAt and subject",
            sender: "establishment",
            email: adminUserEstablishment1.email,
            firstname: adminUserEstablishment1.firstName,
            lastname: adminUserEstablishment1.lastName,
            subject:
              "Réponse de My default business name à votre demande d'immersion",
            sentAt: "2021-09-01T10:10:00.000Z",
            attachments: [],
          });
        });

        it("saves a potentialBeneficiary exchange through dashboard when connected user email matches discussion", async () => {
          await addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello from potential beneficiary",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            potentialBeneficiaryConnectedUser,
          );

          expectToEqual(uow.discussionRepository.discussions[0].exchanges[1], {
            message: "Hello from potential beneficiary",
            sender: "potentialBeneficiary",
            subject: "Réponse de BABA ALI à votre message",
            sentAt: "2021-09-01T10:10:00.000Z",
            attachments: [],
          });
        });
      });

      describe("when discussion status is ACCEPTED", () => {
        const discussionAccepted = new DiscussionBuilder(pendingDiscussion1)
          .withStatus({
            status: "ACCEPTED",
            candidateWarnedMethod: "email",
          })
          .build();

        beforeEach(() => {
          uow.discussionRepository.discussions = [discussionAccepted];
        });

        describe("when sender is establishment", () => {
          it("through inbound parsing, save the new exchange in the discussion and send event", async () => {
            const [firstInboundParsingItem] = createInboundParsingResponse([
              `firstname1_lastname1__${discussionAccepted.id}_e@${replyDomain}`,
            ]).items;

            const expectedNewExchange: Exchange = {
              attachments:
                firstInboundParsingItem.Attachments?.map((attachment) => ({
                  name: attachment.Name,
                  link: attachment.DownloadToken,
                })) ?? [],
              email: adminUserEstablishment1.email,
              firstname: adminUserEstablishment1.firstName,
              lastname: adminUserEstablishment1.lastName,
              message: (firstInboundParsingItem.RawHtmlBody ?? "").trim(),
              sender: "establishment",
              subject: firstInboundParsingItem.Subject,
              sentAt: new Date(
                firstInboundParsingItem.SentAtDate,
              ).toISOString(),
            };

            expectToEqual(
              await addExchangeToDiscussion.execute(
                {
                  source: "inbound-parsing",
                  messageInputs: [
                    {
                      // biome-ignore lint/style/noNonNullAssertion: testing purpose
                      message: firstInboundParsingItem.RawHtmlBody!,
                      discussionId: discussionAccepted.id,
                      recipientRole: "potentialBeneficiary",
                      senderEmail: adminUserEstablishment1.email,
                      sentAt: new Date(
                        firstInboundParsingItem.SentAtDate,
                      ).toISOString(),
                      attachments:
                        firstInboundParsingItem.Attachments?.map(
                          (attachment) => ({
                            name: attachment.Name,
                            link: attachment.DownloadToken,
                          }),
                        ) ?? [],
                      subject: firstInboundParsingItem.Subject,
                    },
                  ],
                },
                undefined,
              ),
              expectedNewExchange,
            );

            expectToEqual(uow.discussionRepository.discussions, [
              {
                ...discussionAccepted,
                updatedAt: timeGateway.now().toISOString(),
                exchanges: [
                  ...discussionAccepted.exchanges,
                  expectedNewExchange,
                ],
              },
            ]);

            expectArraysToMatch(uow.outboxRepository.events, [
              {
                topic: "ExchangeAddedToDiscussion",
              },
            ]);

            expectSavedNotificationsAndEvents({
              emails: [],
              sms: [],
            });
          });

          it("through dashboard, save the new exchange in the discussion", async () => {
            const message = "Hello";
            const result = await addExchangeToDiscussion.execute(
              {
                source: "dashboard",
                messageInputs: [
                  {
                    discussionId: discussionAccepted.id,
                    message: message,
                    recipientRole: "potentialBeneficiary",
                    attachments: [],
                  },
                ],
              },
              adminConnectedUserEstablishment1,
            );

            const expectedNewExchange: Exchange = {
              email: adminUserEstablishment1.email,
              firstname: adminConnectedUserEstablishment1.firstName,
              lastname: adminConnectedUserEstablishment1.lastName,
              subject:
                "Réponse de My default business name à votre demande d'immersion",
              message,
              sentAt: timeGateway.now().toISOString(),
              attachments: [],
              sender: "establishment",
            };

            expectToEqual(result, expectedNewExchange);

            expectToEqual(uow.discussionRepository.discussions, [
              {
                ...discussionAccepted,
                updatedAt: timeGateway.now().toISOString(),
                exchanges: [
                  ...discussionAccepted.exchanges,
                  expectedNewExchange,
                ],
              },
            ]);

            expectArraysToMatch(uow.outboxRepository.events, [
              {
                topic: "ExchangeAddedToDiscussion",
              },
            ]);

            expectSavedNotificationsAndEvents({
              emails: [],
              sms: [],
            });
          });
        });

        describe("when sender is potential beneficiary", () => {
          it("through inbound parsing, do not save the new exchange in the discussion and notify sender that discussion is completed by usecase response & email", async () => {
            const [firstInboundParsingItem] = createInboundParsingResponse([
              `firstname1_lastname1__${discussionAccepted.id}_b@${replyDomain}`,
            ]).items;

            const expectedNewMessage: Exchange = {
              sender: "potentialBeneficiary",
              message: (firstInboundParsingItem.RawHtmlBody ?? "").trim(),
              sentAt: new Date(
                firstInboundParsingItem.SentAtDate,
              ).toISOString(),
              attachments:
                firstInboundParsingItem.Attachments?.map((attachment) => ({
                  name: attachment.Name,
                  link: attachment.DownloadToken,
                })) ?? [],
              subject: firstInboundParsingItem.Subject,
            };
            expectToEqual(
              await addExchangeToDiscussion.execute(
                {
                  source: "inbound-parsing",
                  messageInputs: [
                    {
                      // biome-ignore lint/style/noNonNullAssertion: testing purpose
                      message: firstInboundParsingItem.RawHtmlBody!,
                      discussionId: discussionAccepted.id,
                      recipientRole: "establishment",
                      senderEmail:
                        discussionAccepted.potentialBeneficiary.email,
                      sentAt: new Date(
                        firstInboundParsingItem.SentAtDate,
                      ).toISOString(),
                      attachments:
                        firstInboundParsingItem.Attachments?.map(
                          (attachment) => ({
                            name: attachment.Name,
                            link: attachment.DownloadToken,
                          }),
                        ) ?? [],
                      subject: firstInboundParsingItem.Subject,
                    },
                  ],
                },
                undefined,
              ),
              expectedNewMessage,
            );

            expectToEqual(uow.discussionRepository.discussions, [
              {
                ...discussionAccepted,
                updatedAt: timeGateway.now().toISOString(),
                exchanges: [
                  ...discussionAccepted.exchanges,
                  expectedNewMessage,
                ],
              },
            ]);

            expectArraysToMatch(uow.outboxRepository.events, [
              {
                topic: "ExchangeAddedToDiscussion",
              },
            ]);

            expectSavedNotificationsAndEvents({
              emails: [],
              sms: [],
            });
          });
        });
      });

      describe("when discussion status is REJECTED", () => {
        const discussionRejected = new DiscussionBuilder(pendingDiscussion2)
          .withStatus({
            status: "REJECTED",
            rejectionKind: "NO_TIME",
          })
          .build();

        beforeEach(() => {
          uow.discussionRepository.discussions = [discussionRejected];
        });

        describe("when sender is establishment", () => {
          it("through inbound parsing, save the new exchange in the discussion if and notify sender that discussion is completed by usecase response & email", async () => {
            const [firstInboundParsingItem] = createInboundParsingResponse([
              `firstname1_lastname1__${discussionRejected.id}_e@${replyDomain}`,
            ]).items;

            const expectedResult: DiscussionExchangeForbiddenParams = {
              sender: "establishment",
              reason: "discussion_completed",
              establishmentName: pendingDiscussion1.businessName,
            };
            expectToEqual(
              await addExchangeToDiscussion.execute(
                {
                  source: "inbound-parsing",
                  messageInputs: [
                    {
                      // biome-ignore lint/style/noNonNullAssertion: testing purpose
                      message: firstInboundParsingItem.RawHtmlBody!,
                      discussionId: discussionRejected.id,
                      recipientRole: "potentialBeneficiary",
                      senderEmail: adminUserEstablishment1.email,
                      sentAt: new Date(
                        firstInboundParsingItem.SentAtDate,
                      ).toISOString(),
                      attachments:
                        firstInboundParsingItem.Attachments?.map(
                          (attachment) => ({
                            name: attachment.Name,
                            link: attachment.DownloadToken,
                          }),
                        ) ?? [],
                      subject: firstInboundParsingItem.Subject,
                    },
                  ],
                },
                undefined,
              ),
              expectedResult,
            );

            expectToEqual(uow.discussionRepository.discussions, [
              discussionRejected,
            ]);

            expectArraysToMatch(uow.outboxRepository.events, [
              {
                topic: "NotificationAdded",
              },
            ]);

            expectSavedNotificationsAndEvents({
              emails: [
                {
                  kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                  params: expectedResult,
                  recipients: [adminUserEstablishment1.email],
                },
              ],
              sms: [],
            });
          });

          it("through dashboard, do not save the new exchange in the discussion", async () => {
            const result = await addExchangeToDiscussion.execute(
              {
                source: "dashboard",
                messageInputs: [
                  {
                    discussionId: discussionRejected.id,
                    message: "Hello",
                    recipientRole: "potentialBeneficiary",
                    attachments: [],
                  },
                ],
              },
              adminConnectedUserEstablishment1,
            );

            expectToEqual(result, {
              reason: "discussion_completed",
              sender: "establishment",
              establishmentName: discussionRejected.businessName,
            });

            expectToEqual(uow.discussionRepository.discussions, [
              discussionRejected,
            ]);

            expectArraysToMatch(uow.outboxRepository.events, []);

            expectSavedNotificationsAndEvents({
              emails: [],
              sms: [],
            });
          });
        });

        describe("when sender is potential beneficiary", () => {
          it("through inbound parsing, do not save the new exchange in the discussion and notify sender that discussion is completed by usecase response & email", async () => {
            const [firstInboundParsingItem] = createInboundParsingResponse([
              `firstname1_lastname1__${discussionRejected.id}_b@${replyDomain}`,
            ]).items;

            const result = await addExchangeToDiscussion.execute(
              {
                source: "inbound-parsing",
                messageInputs: [
                  {
                    // biome-ignore lint/style/noNonNullAssertion: testing purpose
                    message: firstInboundParsingItem.RawHtmlBody!,
                    discussionId: discussionRejected.id,
                    recipientRole: "establishment",
                    senderEmail: discussionRejected.potentialBeneficiary.email,
                    sentAt: new Date(
                      firstInboundParsingItem.SentAtDate,
                    ).toISOString(),
                    attachments:
                      firstInboundParsingItem.Attachments?.map(
                        (attachment) => ({
                          name: attachment.Name,
                          link: attachment.DownloadToken,
                        }),
                      ) ?? [],
                    subject: firstInboundParsingItem.Subject,
                  },
                ],
              },
              undefined,
            );

            expectToEqual(result, {
              reason: "discussion_completed",
              sender: "potentialBeneficiary",
              establishmentName: discussionRejected.businessName,
            });

            expectToEqual(uow.discussionRepository.discussions, [
              discussionRejected,
            ]);

            expectArraysToMatch(uow.outboxRepository.events, [
              {
                topic: "NotificationAdded",
              },
            ]);

            expectSavedNotificationsAndEvents({
              emails: [
                {
                  kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                  params: {
                    reason: "discussion_completed",
                    sender: "potentialBeneficiary",
                    establishmentName: pendingDiscussion1.businessName,
                  },
                  recipients: [discussionRejected.potentialBeneficiary.email],
                },
              ],
              sms: [],
            });
          });
        });
      });
    });
  });

  describe("wrong paths", () => {
    const requestEstablishmentRegistrationUrl: AbsoluteUrl = `https://www.fake-immersion-facile-base-url.com/mon-compte/tableau-de-bord-etablissement/rattachement-entreprise?siret=${pendingDiscussion1.siret}`;
    it("throws an error if the discussion does not exist", async () => {
      const notFoundDiscussionId = "99999999-e89b-12d3-a456-426614174000";

      await expectPromiseToFailWithError(
        addExchangeToDiscussion.execute(
          {
            source: "inbound-parsing",
            messageInputs: [
              {
                // biome-ignore lint/style/noNonNullAssertion: testing purpose
                message: createInboundParsingResponse([
                  `firstname_lastname__${notFoundDiscussionId}_e@${replyDomain}`,
                ]).items[0].RawHtmlBody!,
                discussionId: notFoundDiscussionId,
                recipientRole: "establishment",
                senderEmail: pendingDiscussion1.potentialBeneficiary.email,
                attachments: [],
                subject: "",
                sentAt: new Date().toISOString(),
              },
            ],
          },
          undefined,
        ),
        errors.discussion.notFound({ discussionId: notFoundDiscussionId }),
      );
    });

    it("throws an error if the source is dashboard, but user is not connected", async () => {
      await expectPromiseToFailWithError(
        addExchangeToDiscussion.execute(
          {
            source: "dashboard",
            messageInputs: [
              {
                message: "Hello",
                discussionId: "11111111-e89b-12d3-a456-426614174000",
                recipientRole: "potentialBeneficiary",
                attachments: [],
              },
            ],
          },
          undefined,
        ),
        errors.user.unauthorized(),
      );
    });

    describe("when establishment is banned", () => {
      const bannedEstablishment = new EstablishmentAggregateBuilder(
        establishment1,
      )
        .withBannishmentInformations({
          isEstablishmentBanned: true,
          establishmentBannishmentJustification:
            "Ils ont ramené un yacht dans le golf du Morbihan",
        })
        .build();

      beforeEach(() => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          bannedEstablishment,
        ];
      });
      describe("when sender is establishment", () => {
        it("through inbound parsing, do not save the new exchange in the discussion and notify sender that establishment is banned", async () => {
          const [firstInboundParsingItem] = createInboundParsingResponse([
            `firstname1_lastname1__${pendingDiscussion1.id}_b@${replyDomain}`,
          ]).items;

          const result = await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  senderEmail: adminUserEstablishment1.email,
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: firstInboundParsingItem.Subject,
                },
              ],
            },
            undefined,
          );

          expectToEqual(result, {
            reason: "establishment_banned",
            sender: "establishment",
            establishmentName: pendingDiscussion1.businessName,
          } satisfies DiscussionExchangeForbiddenParams);

          expectToEqual(uow.discussionRepository.discussions, [
            pendingDiscussion1,
            pendingDiscussion2,
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "NotificationAdded",
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                params: {
                  reason: "establishment_banned",
                  sender: "establishment",
                  establishmentName: pendingDiscussion1.businessName,
                },
                recipients: [adminUserEstablishment1.email],
              },
            ],
            sms: [],
          });
        });
      });

      describe("when sender is beneficiary", () => {
        it("through inbound parsing, do not save the new exchange in the discussion and notify sender that establishment is banned", async () => {
          const [firstInboundParsingItem] = createInboundParsingResponse([
            `firstname1_lastname1__${pendingDiscussion1.id}_b@${replyDomain}`,
          ]).items;

          const result = await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "establishment",
                  senderEmail: pendingDiscussion1.potentialBeneficiary.email,
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: firstInboundParsingItem.Subject,
                },
              ],
            },
            undefined,
          );

          expectToEqual(result, {
            reason: "establishment_banned",
            sender: "potentialBeneficiary",
            establishmentName: pendingDiscussion1.businessName,
          } satisfies DiscussionExchangeForbiddenParams);

          expectToEqual(uow.discussionRepository.discussions, [
            pendingDiscussion1,
            pendingDiscussion2,
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "NotificationAdded",
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                params: {
                  reason: "establishment_banned",
                  sender: "potentialBeneficiary",
                  establishmentName: pendingDiscussion1.businessName,
                },
                recipients: [pendingDiscussion1.potentialBeneficiary.email],
              },
            ],
            sms: [],
          });
        });
      });
    });

    describe("when establishment does not exist", () => {
      beforeEach(() => {
        uow.establishmentAggregateRepository.establishmentAggregates = [];
      });

      describe("when sender is establishment", () => {
        it("through inbound parsing, do not save the new exchange in the discussion and notify sender that establishment does not exist by usecase response and email", async () => {
          const [firstInboundParsingItem] = createInboundParsingResponse([
            `firstname1_lastname1__${pendingDiscussion1.id}_e@${replyDomain}`,
          ]).items;

          const result = await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  senderEmail: adminUserEstablishment1.email,
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: firstInboundParsingItem.Subject,
                },
              ],
            },
            undefined,
          );

          expectToEqual(result, {
            reason: "establishment_missing",
            sender: "establishment",
            establishmentName: pendingDiscussion1.businessName,
          });

          expectToEqual(uow.discussionRepository.discussions, [
            pendingDiscussion1,
            pendingDiscussion2,
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "NotificationAdded",
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                params: {
                  reason: "establishment_missing",
                  sender: "establishment",
                  establishmentName: pendingDiscussion1.businessName,
                },
                recipients: [adminUserEstablishment1.email],
              },
            ],
            sms: [],
          });
        });

        it("through dahsboard, do not save the new exchange in the discussion and notify sender that establishment does not exist by usecase response only", async () => {
          const result = await addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment1,
          );

          expectToEqual(result, {
            reason: "establishment_missing",
            sender: "establishment",
            establishmentName: pendingDiscussion1.businessName,
          });

          expectToEqual(uow.discussionRepository.discussions, [
            pendingDiscussion1,
            pendingDiscussion2,
          ]);

          expectArraysToMatch(uow.outboxRepository.events, []);

          expectSavedNotificationsAndEvents({
            emails: [],
            sms: [],
          });
        });
      });

      describe("when sender is potential beneficiary", () => {
        it("through inbound parsing, do not save the new exchange in the discussion and notify sender that establishment does not exist by usecase response and email", async () => {
          const [firstInboundParsingItem] = createInboundParsingResponse([
            `firstname1_lastname1__${pendingDiscussion1.id}_e@${replyDomain}`,
          ]).items;

          const result = await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  // biome-ignore lint/style/noNonNullAssertion: testing purpose
                  message: firstInboundParsingItem.RawHtmlBody!,
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "establishment",
                  senderEmail: pendingDiscussion1.potentialBeneficiary.email,
                  sentAt: new Date(
                    firstInboundParsingItem.SentAtDate,
                  ).toISOString(),
                  attachments:
                    firstInboundParsingItem.Attachments?.map((attachment) => ({
                      name: attachment.Name,
                      link: attachment.DownloadToken,
                    })) ?? [],
                  subject: firstInboundParsingItem.Subject,
                },
              ],
            },
            undefined,
          );

          expectToEqual(result, {
            reason: "establishment_missing",
            sender: "potentialBeneficiary",
            establishmentName: pendingDiscussion1.businessName,
          });

          expectToEqual(uow.discussionRepository.discussions, [
            pendingDiscussion1,
            pendingDiscussion2,
          ]);

          expectArraysToMatch(uow.outboxRepository.events, [
            {
              topic: "NotificationAdded",
            },
          ]);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
                params: {
                  reason: "establishment_missing",
                  sender: "potentialBeneficiary",
                  establishmentName: pendingDiscussion1.businessName,
                },
                recipients: [pendingDiscussion1.potentialBeneficiary.email],
              },
            ],
            sms: [],
          });
        });
      });
    });

    describe("when sender is not potential beneficiary and don't have right on establishment", () => {
      const establishmentWithoutRight = new EstablishmentAggregateBuilder(
        establishment1,
      )
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "",
            phone: "",
            shouldReceiveDiscussionNotifications: true,
            userId: adminUserEstablishment1.id,
            isMainContactByPhone: false,
          },
        ])
        .build();

      beforeEach(() => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          establishmentWithoutRight,
        ];
      });

      it("through inbound parsing, do not save the new exchange in the discussion and notify sender that user has no rights on establishment", async () => {
        expectToEqual(
          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  senderEmail: contactUserEstablishment2.email,
                  sentAt: timeGateway.now().toISOString(),
                  subject: "",
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment1,
          ),
          {
            reason: "user_unknown_or_missing_rights_on_establishment",
            sender: "establishment",
            requestEstablishmentRegistrationUrl,
          },
        );

        expectToEqual(uow.discussionRepository.discussions, [
          pendingDiscussion1,
          pendingDiscussion2,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "NotificationAdded",
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
              params: {
                reason: "user_unknown_or_missing_rights_on_establishment",
                sender: "establishment",
                requestEstablishmentRegistrationUrl,
              },
              recipients: [contactUserEstablishment2.email],
            },
          ],
          sms: [],
        });
      });

      it("through dashboard, throws a forbidden error ", async () => {
        await expectPromiseToFailWithError(
          addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment2,
          ),
          errors.establishment.notAdminOrContactRight({
            userId: adminConnectedUserEstablishment2.id,
            siret: establishmentWithoutRight.establishment.siret,
          }),
        );
      });
    });

    describe("when sender is not potential beneficiary and is missing from users", () => {
      beforeEach(() => {
        uow.userRepository.users = [adminConnectedUserEstablishment1];
      });

      it("through inbound parsing, do not save the new exchange in the discussion and notify sender that user has no rights on establishment", async () => {
        expectToEqual(
          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  senderEmail: adminConnectedUserEstablishment2.email,
                  attachments: [],
                  discussionId: pendingDiscussion1.id,
                  message: "Hello",
                  recipientRole: "potentialBeneficiary",
                  sentAt: new Date().toISOString(),
                  subject: "OSEF",
                },
              ],
            },
            undefined,
          ),
          {
            reason: "user_unknown_or_missing_rights_on_establishment",
            sender: "establishment",
            requestEstablishmentRegistrationUrl,
          },
        );

        expectToEqual(uow.discussionRepository.discussions, [
          pendingDiscussion1,
          pendingDiscussion2,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "NotificationAdded",
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
              params: {
                reason: "user_unknown_or_missing_rights_on_establishment",
                sender: "establishment",
                requestEstablishmentRegistrationUrl,
              },
              recipients: [adminConnectedUserEstablishment2.email],
            },
          ],
          sms: [],
        });
      });

      it("through dashboard, throws a notFound user error", async () => {
        await expectPromiseToFailWithError(
          addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            adminConnectedUserEstablishment2,
          ),
          errors.user.notFound({ userId: adminConnectedUserEstablishment2.id }),
        );
      });
    });

    describe("when sender is existing user but is not allowed to send message to the discussion", () => {
      const connectedUserWithNoRightsOnDiscussion = new ConnectedUserBuilder()
        .withId("no-rights-user")
        .withFirstName("No")
        .withLastName("Rights")
        .withEmail("no.rights@establishment.com")
        .build();

      beforeEach(() => {
        uow.userRepository.users = [
          adminConnectedUserEstablishment1,
          connectedUserWithNoRightsOnDiscussion,
        ];
      });

      it("through inbound parsing, do not save the new exchange in the discussion and notify sender that user has no rights on establishment", async () => {
        expectToEqual(
          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  senderEmail: connectedUserWithNoRightsOnDiscussion.email,
                  attachments: [],
                  discussionId: pendingDiscussion1.id,
                  message: "Hello",
                  recipientRole: "potentialBeneficiary",
                  sentAt: new Date().toISOString(),
                  subject: "OSEF",
                },
              ],
            },
            undefined,
          ),
          {
            reason: "user_unknown_or_missing_rights_on_establishment",
            sender: "establishment",
            requestEstablishmentRegistrationUrl,
          },
        );

        expectToEqual(uow.discussionRepository.discussions, [
          pendingDiscussion1,
          pendingDiscussion2,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "NotificationAdded",
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
              params: {
                reason: "user_unknown_or_missing_rights_on_establishment",
                sender: "establishment",
                requestEstablishmentRegistrationUrl,
              },
              recipients: [connectedUserWithNoRightsOnDiscussion.email],
            },
          ],
          sms: [],
        });
      });

      it("through dashboard - throws a notAdminOrContactRight error", async () => {
        await expectPromiseToFailWithError(
          addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            connectedUserWithNoRightsOnDiscussion,
          ),
          errors.establishment.notAdminOrContactRight({
            userId: connectedUserWithNoRightsOnDiscussion.id,
            siret: establishment1.establishment.siret,
          }),
        );
      });
    });

    describe("when sender email is not discussion potential beneficiary (or establishment) email and not existing user", () => {
      const unknownUser = new ConnectedUserBuilder().build();

      it("through inbound parsing, do not save the new exchange in the discussion and notify sender that user has no rights on establishment", async () => {
        expectToEqual(
          await addExchangeToDiscussion.execute(
            {
              source: "inbound-parsing",
              messageInputs: [
                {
                  senderEmail: unknownUser.email,
                  attachments: [],
                  discussionId: pendingDiscussion1.id,
                  message: "Hello",
                  recipientRole: "establishment",
                  sentAt: new Date().toISOString(),
                  subject: "OSEF",
                },
              ],
            },
            undefined,
          ),
          {
            reason: "user_unknown_or_missing_rights_on_establishment",
            sender: "potentialBeneficiary",
            requestEstablishmentRegistrationUrl,
          },
        );

        expectToEqual(uow.discussionRepository.discussions, [
          pendingDiscussion1,
          pendingDiscussion2,
        ]);

        expectArraysToMatch(uow.outboxRepository.events, [
          {
            topic: "NotificationAdded",
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
              params: {
                reason: "user_unknown_or_missing_rights_on_establishment",
                sender: "potentialBeneficiary",
                requestEstablishmentRegistrationUrl,
              },
              recipients: [unknownUser.email],
            },
          ],
          sms: [],
        });
      });

      it("through dashboard, throws a missing user error", async () => {
        await expectPromiseToFailWithError(
          addExchangeToDiscussion.execute(
            {
              source: "dashboard",
              messageInputs: [
                {
                  message: "Hello",
                  discussionId: pendingDiscussion1.id,
                  recipientRole: "potentialBeneficiary",
                  attachments: [],
                },
              ],
            },
            unknownUser,
          ),
          errors.user.notFound({ userId: unknownUser.id }),
        );
      });
    });

    it("through inbound parsing, throws an error if user right of sender is pending", async () => {
      const userId: UserId = "usefIaaaaad2c-6f02-11ec-90d6-0242ac120012";
      const userWithPendingRight = new ConnectedUserBuilder()
        .withId(userId)
        .withProConnectInfos(null)
        .withEmail("pending-user@test.com")
        .build();
      const establishmentAggregateWithPendingUserRight =
        new EstablishmentAggregateBuilder(establishment1)
          .withUserRights([
            {
              userId: userWithPendingRight.id,
              status: "PENDING",
              role: "establishment-contact",
              shouldReceiveDiscussionNotifications: true,
            },
          ])
          .build();

      await uow.userRepository.save(userWithPendingRight);
      await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentAggregateWithPendingUserRight,
      );

      expectToEqual(
        await addExchangeToDiscussion.execute(
          {
            source: "inbound-parsing",
            messageInputs: [
              {
                senderEmail: userWithPendingRight.email,
                message: "Hello",
                discussionId: pendingDiscussion1.id,
                recipientRole: "potentialBeneficiary",
                attachments: [],
                sentAt: new Date().toISOString(),
                subject: "fake subject",
              },
            ],
          },
          userWithPendingRight,
        ),
        {
          reason: "user_unknown_or_missing_rights_on_establishment",
          sender: "establishment",
          requestEstablishmentRegistrationUrl: `https://www.fake-immersion-facile-base-url.com/mon-compte/tableau-de-bord-etablissement/rattachement-entreprise?siret=${pendingDiscussion1.siret}`,
        },
      );

      expectToEqual(uow.discussionRepository.discussions, [
        pendingDiscussion1,
        pendingDiscussion2,
      ]);

      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "DISCUSSION_EXCHANGE_FORBIDDEN",
            params: {
              reason: "user_unknown_or_missing_rights_on_establishment",
              sender: "establishment",
              requestEstablishmentRegistrationUrl: `https://www.fake-immersion-facile-base-url.com/mon-compte/tableau-de-bord-etablissement/rattachement-entreprise?siret=${pendingDiscussion1.siret}`,
            },
            recipients: [userWithPendingRight.email],
          },
        ],
        sms: [],
      });
    });
    it("through dashboard,throws an error if user right of sender is pending", async () => {
      const userId: UserId = "usefIaaaaad2c-6f02-11ec-90d6-0242ac120012";
      const userWithPendingRight = new ConnectedUserBuilder()
        .withId(userId)
        .withProConnectInfos(null)
        .withEmail("pending-user@test.com")
        .build();
      const establishmentAggregateWithPendingUserRight =
        new EstablishmentAggregateBuilder(establishment1)
          .withUserRights([
            {
              userId: userWithPendingRight.id,
              status: "PENDING",
              role: "establishment-contact",
              shouldReceiveDiscussionNotifications: true,
            },
          ])
          .build();

      await uow.userRepository.save(userWithPendingRight);
      await uow.establishmentAggregateRepository.insertEstablishmentAggregate(
        establishmentAggregateWithPendingUserRight,
      );

      await expectPromiseToFailWithError(
        addExchangeToDiscussion.execute(
          {
            source: "dashboard",
            messageInputs: [
              {
                message: "Hello",
                discussionId: pendingDiscussion1.id,
                recipientRole: "potentialBeneficiary",
                attachments: [],
              },
            ],
          },
          userWithPendingRight,
        ),
        errors.establishment.notAdminOrContactRight({
          userId: userWithPendingRight.id,
          siret: establishment1.establishment.siret,
        }),
      );
    });
  });

  const createInboundParsingResponse = (
    toAddresses: string[],
    subject?: string,
  ): BrevoInboundBody => ({
    items: toAddresses.map((address) => ({
      Uuid: ["8d79f2b1-20ae-4939-8d0b-d2517331a9e5"],
      MessageId:
        "<CADYedJsX7_KwtMJem4m-Dhwqp5fmBiqrdMzzDBu-7nbfAuY=ew@mail.gmail.com>",
      InReplyTo:
        "<CADYedJsS=ZXd8RPDjNuD7GhOwCgvaLwvAS=2kU3N+sd5wgu6Ag@mail.gmail.com>",
      From: {
        Name: "Enguerran Weiss",
        Address: "enguerranweiss@gmail.com",
      },
      To: [
        {
          Name: null,
          Address: address,
        },
      ],
      Cc: [
        {
          Name: null,
          Address: "gerard2@reply-dev.immersion-facile.beta.gouv.fr",
        },
        {
          Name: null,
          Address: "gerard-cc@reply-dev.imersion-facile.beta.gouv.fr",
        },
      ],
      ReplyTo: null,
      SentAtDate: "Wed, 28 Jun 2023 10:06:52 +0200",
      Subject: subject ?? `Sending message to ${address}`,
      Attachments: [
        {
          Name: "IMG_20230617_151239.jpg",
          ContentType: "image/jpeg",
          ContentLength: 1652571,
          ContentID: "ii_ljff7lfo0",
          DownloadToken:
            "eyJmb2xkZXIiOiIyMDIzMDYyODA4MDcwNy41Ni4xNTQxNDI5NTQwIiwiZmlsZW5hbWUiOiJJTUdfMjAyMzA2MTdfMTUxMjM5LmpwZyJ9",
        },
      ],

      RawHtmlBody:
        '<div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:57<br>Subject: Fwd: Hey !<br>To: &lt;<a href="mailto:tristan@reply-dev.immersion-facile.beta.gouv.fr">tristan@reply-dev.immersion-facile.beta.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><br><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De : <b class="gmail_sendername" dir="auto">Enguerran Weiss</b> <span dir="auto">&lt;<a href="mailto:enguerranweiss@gmail.com" target="_blank">enguerranweiss@gmail.com</a>&gt;</span><br>Date: mer. 28 juin 2023 à 09:55<br>Subject: Hey !<br>To: &lt;<a href="mailto:roger@reply-dev.immersion-facile.gouv.fr" target="_blank">roger@reply-dev.immersion-facile.gouv.fr</a>&gt;<br></div><br><br><div dir="ltr"><div><br clear="all"></div><div>Comment ça va ?</div><div><br></div><div><img src="cid:ii_ljff7lfo0" alt="IMG_20230617_151239.jpg" style="margin-right:0px" width="223" height="167"></div><div><br></div><div><br></div><div>A + !<br></div><div><br></div><div><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div></div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div></div><br clear="all"><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr"><div><div dir="ltr"><span style="color:rgb(0,0,0);font-family:Times;font-size:medium"><img src="http://goodies.enguerranweiss.fr/id/sign_html-v2-bl.png"></span><p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:rgb(102,102,102)"></p><p style="font-family:Georgia,serif;font-size:11px;color:rgb(102,102,102)">+33(0)6 10 13 76 84 <br><a href="mailto:hello@enguerranweiss.fr" target="_blank">hello@enguerranweiss.fr</a><br><a href="http://www.enguerranweiss.fr" target="_blank">http://www.enguerranweiss.fr</a></p></div></div></div></div></div>',
      RawTextBody:
        "---------- Forwarded message ---------\r\nDe : Enguerran Weiss <enguerranweiss@gmail.com>\r\nDate: mer. 28 juin 2023 à 09:57\r\nSubject: Fwd: Hey !\r\nTo: <tristan@reply-dev.immersion-facile.beta.gouv.fr>\r\n\n\n\n\n---------- Forwarded message ---------\r\nDe : Enguerran Weiss <enguerranweiss@gmail.com>\r\nDate: mer. 28 juin 2023 à 09:55\r\nSubject: Hey !\r\nTo: <roger@reply-dev.immersion-facile.gouv.fr>\r\n\n\n\nComment ça va ?\r\n\n[image: IMG_20230617_151239.jpg]\r\n\n\nA + !\r\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n\n\n-- \r\n\n+33(0)6 10 13 76 84\r\nhello@enguerranweiss.fr\r\nhttp://www.enguerranweiss.fr\r\n",
    })),
  });
});
