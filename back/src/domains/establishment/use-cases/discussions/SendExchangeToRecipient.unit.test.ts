import { addHours, addMinutes } from "date-fns";
import {
  type Attachment,
  ConnectedUserBuilder,
  DiscussionBuilder,
  discussionEmailSender,
  type EstablishmentExchange,
  type Exchange,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type PotentialBeneficiaryExchange,
} from "shared";
import { v4 as uuid } from "uuid";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { InMemoryNotificationGateway } from "../../../core/notifications/adapters/InMemoryNotificationGateway";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import type { EstablishmentUserRight } from "../../entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  makeSendExchangeToRecipient,
  type SendExchangeToRecipient,
} from "./SendExchangeToRecipient";

describe("SendExchangeToRecipient", () => {
  const now = new Date();
  const base64RawContent = Buffer.from("my-attachment-content").toString(
    "base64",
  );
  const link = "pdf";
  const notABlobLink = "notABlobLink";

  const admin = new ConnectedUserBuilder()
    .withId(uuid())
    .withFirstName("Ali")
    .withLastName("Baba")
    .withEmail("ali.baba@establishment.com")
    .buildUser();
  const contact = new ConnectedUserBuilder()
    .withId(uuid())
    .withFirstName("Billy")
    .withLastName("Idol")
    .withEmail("billy.idol@establishment.com")
    .buildUser();

  const pendingUser = new ConnectedUserBuilder()
    .withId(uuid())
    .withFirstName("Pending")
    .withLastName("User")
    .withEmail("pending.user@establishment.com")
    .buildUser();

  const notifiedEstablishmentRights: EstablishmentUserRight[] = [
    {
      role: "establishment-admin",
      status: "ACCEPTED",
      userId: admin.id,
      job: "",
      phone: "",
      shouldReceiveDiscussionNotifications: true,
      isMainContactByPhone: false,
    },
    {
      role: "establishment-contact",
      status: "ACCEPTED",
      userId: contact.id,
      shouldReceiveDiscussionNotifications: true,
    },
  ];

  const establishmentAggregate = new EstablishmentAggregateBuilder()
    .withUserRights(notifiedEstablishmentRights)
    .build();

  const establishmentAggregateWithOnlyPendingUser =
    new EstablishmentAggregateBuilder()
      .withUserRights([
        {
          role: "establishment-admin",
          status: "PENDING",
          userId: pendingUser.id,
          shouldReceiveDiscussionNotifications: true,
          job: "",
          phone: "",
          isMainContactByPhone: false,
        },
      ])
      .build();

  const discussionWithSiretAndAppellation = new DiscussionBuilder()
    .withSiret(establishmentAggregate.establishment.siret)
    .withAppellationCode("20567")
    .withExchanges([])
    .build();

  const firstBeneficiaryExchange: Exchange = {
    subject: "My subject - discussion 1",
    message: "Hello",
    sender: "potentialBeneficiary",
    sentAt: addHours(now, -2).toISOString(),
    attachments: [],
  };

  const lastBeneficiaryExchange: Exchange = {
    subject: "My subject - discussion 1",
    message: "My response",
    sender: "potentialBeneficiary",
    sentAt: addMinutes(now, -30).toISOString(),
    attachments: [],
  };

  const makeLastEstablishmentExchange = (
    message: string,
    attachments: Attachment[],
  ): EstablishmentExchange => ({
    sender: "establishment",
    firstname: admin.firstName,
    lastname: admin.lastName,
    email: admin.email,
    sentAt: addHours(now, -1).toISOString(),
    message,
    subject: "subject",
    attachments,
  });

  let useCase: SendExchangeToRecipient;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let timeGateway: CustomTimeGateway;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    const notificationGateway = new InMemoryNotificationGateway();
    timeGateway = new CustomTimeGateway(now);

    useCase = makeSendExchangeToRecipient({
      deps: {
        domain: "my-domain.com",
        notificationGateway,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          timeGateway,
        ),
        config: new AppConfigBuilder().build(),
      },
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    notificationGateway.attachmentsByLinks = {
      [link]: base64RawContent,
      [notABlobLink]: "not-a-blob",
    };
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
    ];
    uow.userRepository.users = [admin, contact, pendingUser];
  });

  describe("right paths", () => {
    describe("sends the email to the right recipient", () => {
      it("when last exchange is from establishment, the exchange is sent to the potential beneficiary", async () => {
        const lastEstablishmentExchange = makeLastEstablishmentExchange(
          "message",
          [{ link, name: "Piece jointe.pdf" }],
        );
        const discussion = new DiscussionBuilder(
          discussionWithSiretAndAppellation,
        )
          .withExchanges([firstBeneficiaryExchange, lastEstablishmentExchange])
          .build();

        uow.discussionRepository.discussions = [discussion];

        await useCase.execute({
          discussionId: discussion.id,
        });

        expectToEqual(uow.discussionRepository.discussions, [discussion]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE",
              params: {
                htmlContent: `
                  ⚠️ Important : Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. 
                  Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.
                  <div style="color: #b5b5b5; font-size: 12px">Pour rappel, voici les informations liées à cette mise en relation :
                  <br /><ul>
                  <li>Candidat : ali baba</li>
                  <li>Métier : Vendeur / Vendeuse en chocolaterie</li>
                  <li>Entreprise : My default business name - 1 rue de la Paix 75001 Paris</li>
                  </ul><br />
                  
    <a href="http://localhost/mon-compte/tableau-de-bord-beneficiaire/discussions/${discussion.id}?at_campaign=inbound-parsing-reponse-via-tableau-de-bord" style="display: inline-flex; align-items: center; margin: 1.5rem 0; font-weight: 500; font-size: 0.875rem; line-height: 1.5rem; min-height: 2rem; padding: 0.25rem 0.75rem; background-color: #000091; color: #f5f5fe; text-decoration: none;">Répondre depuis mon espace</a>
  
                  </div>
            ${lastEstablishmentExchange.message}`,
                subject: lastEstablishmentExchange.subject,
              },
              recipients: [discussion.potentialBeneficiary.email],
              replyTo: {
                email: `${lastEstablishmentExchange.firstname.toLocaleLowerCase()}_${lastEstablishmentExchange.lastname.toLocaleLowerCase()}__${discussion.id}_e@reply.my-domain.com`,
                name: `${lastEstablishmentExchange.firstname} ${lastEstablishmentExchange.lastname} - ${discussion.businessName}`,
              },
              sender: discussionEmailSender,
              attachments: [
                {
                  name: lastEstablishmentExchange.attachments[0].name,
                  content: base64RawContent,
                },
              ],
            },
          ],
        });
      });

      it("when last exchange is from potential beneficiary, the exchange is sent to establishment users that have enabled notifications", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [
          new EstablishmentAggregateBuilder(establishmentAggregate)
            .withUserRights([
              ...notifiedEstablishmentRights,
              {
                role: "establishment-admin",
                status: "ACCEPTED",
                userId: "otherUser1",
                shouldReceiveDiscussionNotifications: false,
                job: "",
                phone: "",
                isMainContactByPhone: false,
              },
              {
                role: "establishment-contact",
                status: "ACCEPTED",
                userId: "otherUser2",
                shouldReceiveDiscussionNotifications: false,
              },
            ])
            .build(),
        ];

        const lastBeneficiaryExchange: PotentialBeneficiaryExchange = {
          sender: "potentialBeneficiary",
          attachments: [{ link, name: "La maitresse de Chacakan.pdf" }],
          message: "Coucou!",
          sentAt: addMinutes(now, -30).toISOString(),
          subject: "C'est mon truc",
        };

        const discussion = new DiscussionBuilder(
          discussionWithSiretAndAppellation,
        )
          .withExchanges([
            firstBeneficiaryExchange,
            makeLastEstablishmentExchange("message", [
              { link, name: "Piece jointe.pdf" },
            ]),
            lastBeneficiaryExchange,
          ])
          .build();

        uow.discussionRepository.discussions = [discussion];

        await useCase.execute({
          discussionId: discussion.id,
        });

        expectToEqual(uow.discussionRepository.discussions, [discussion]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE",
              params: {
                htmlContent: `
                  ⚠️ Important : Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. 
                  Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.
                  <div style="color: #b5b5b5; font-size: 12px">Pour rappel, voici les informations liées à cette mise en relation :
                  <br /><ul>
                  <li>Candidat : ali baba</li>
                  <li>Métier : Vendeur / Vendeuse en chocolaterie</li>
                  <li>Entreprise : My default business name - 1 rue de la Paix 75001 Paris</li>
                  </ul><br />
                  
    <a href="http://localhost/mon-compte/tableau-de-bord-etablissement/discussions/${discussion.id}?at_campaign=inbound-parsing-reponse-via-tableau-de-bord" style="display: inline-flex; align-items: center; margin: 1.5rem 0; font-weight: 500; font-size: 0.875rem; line-height: 1.5rem; min-height: 2rem; padding: 0.25rem 0.75rem; background-color: #000091; color: #f5f5fe; text-decoration: none;">Répondre depuis mon espace</a>
  
                  </div>
            ${lastBeneficiaryExchange.message}`,
                subject: lastBeneficiaryExchange.subject,
              },
              recipients: [admin.email, contact.email],
              replyTo: {
                email: `${discussion.potentialBeneficiary.firstName}_${discussion.potentialBeneficiary.lastName}__${discussion.id}_b@reply.my-domain.com`,
                name: `${discussion.potentialBeneficiary.firstName} ${discussion.potentialBeneficiary.lastName}`,
              },
              sender: discussionEmailSender,
              attachments: [
                {
                  name: lastBeneficiaryExchange.attachments[0].name,
                  content: base64RawContent,
                },
              ],
            },
          ],
        });
      });
    });

    describe("Specific scenarios", () => {
      it("skips the use case, if the skip parameter is provided", async () => {
        uow.discussionRepository.discussions = [
          discussionWithSiretAndAppellation,
        ];

        await useCase.execute({
          skipSendingEmail: true,
          discussionId: discussionWithSiretAndAppellation.id,
        });

        expectSavedNotificationsAndEvents({
          emails: [],
          sms: [],
        });
      });

      it("sends the email with a default message if not provided", async () => {
        const lastEstablishmentExchange = makeLastEstablishmentExchange("", [
          { link, name: "Piece jointe.pdf" },
        ]);
        const discussion = new DiscussionBuilder(
          discussionWithSiretAndAppellation,
        )
          .withExchanges([firstBeneficiaryExchange, lastEstablishmentExchange])
          .build();

        uow.discussionRepository.discussions = [discussion];

        await useCase.execute({
          discussionId: discussion.id,
        });

        expectToEqual(uow.discussionRepository.discussions, [discussion]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE",
              params: {
                htmlContent: `
                  ⚠️ Important : Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. 
                  Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.
                  <div style="color: #b5b5b5; font-size: 12px">Pour rappel, voici les informations liées à cette mise en relation :
                  <br /><ul>
                  <li>Candidat : ali baba</li>
                  <li>Métier : Vendeur / Vendeuse en chocolaterie</li>
                  <li>Entreprise : My default business name - 1 rue de la Paix 75001 Paris</li>
                  </ul><br />
                  
    <a href="http://localhost/mon-compte/tableau-de-bord-beneficiaire/discussions/${discussion.id}?at_campaign=inbound-parsing-reponse-via-tableau-de-bord" style="display: inline-flex; align-items: center; margin: 1.5rem 0; font-weight: 500; font-size: 0.875rem; line-height: 1.5rem; min-height: 2rem; padding: 0.25rem 0.75rem; background-color: #000091; color: #f5f5fe; text-decoration: none;">Répondre depuis mon espace</a>
  
                  </div>
            ${"--- pas de message ---"}`,
                subject: lastEstablishmentExchange.subject,
              },
              recipients: [discussion.potentialBeneficiary.email],
              replyTo: {
                email: `${lastEstablishmentExchange.firstname.toLocaleLowerCase()}_${lastEstablishmentExchange.lastname.toLocaleLowerCase()}__${discussion.id}_e@reply.my-domain.com`,
                name: `${lastEstablishmentExchange.firstname} ${lastEstablishmentExchange.lastname} - ${discussion.businessName}`,
              },
              sender: discussionEmailSender,
              attachments: [
                {
                  name: lastEstablishmentExchange.attachments[0].name,
                  content: base64RawContent,
                },
              ],
            },
          ],
        });
      });

      it("sends the email to the right recipient without attachment when last exchange attachment is not a blob link", async () => {
        const lastExchange: Exchange = makeLastEstablishmentExchange(
          "message",
          [{ link: notABlobLink, name: "VCard" }],
        );

        const discussion = new DiscussionBuilder(
          discussionWithSiretAndAppellation,
        )
          .withExchanges([firstBeneficiaryExchange, lastExchange])
          .build();

        uow.discussionRepository.discussions = [discussion];

        await useCase.execute({
          discussionId: discussion.id,
        });

        expectToEqual(uow.discussionRepository.discussions, [discussion]);

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE",
              params: {
                htmlContent: `
                  ⚠️ Important : Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. 
                  Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.
                  <div style="color: #b5b5b5; font-size: 12px">Pour rappel, voici les informations liées à cette mise en relation :
                  <br /><ul>
                  <li>Candidat : ali baba</li>
                  <li>Métier : Vendeur / Vendeuse en chocolaterie</li>
                  <li>Entreprise : My default business name - 1 rue de la Paix 75001 Paris</li>
                  </ul><br />
                  
    <a href="http://localhost/mon-compte/tableau-de-bord-beneficiaire/discussions/${discussion.id}?at_campaign=inbound-parsing-reponse-via-tableau-de-bord" style="display: inline-flex; align-items: center; margin: 1.5rem 0; font-weight: 500; font-size: 0.875rem; line-height: 1.5rem; min-height: 2rem; padding: 0.25rem 0.75rem; background-color: #000091; color: #f5f5fe; text-decoration: none;">Répondre depuis mon espace</a>
  
                  </div>
            ${lastExchange.message}`,
                subject: lastExchange.subject,
              },
              recipients: [discussion.potentialBeneficiary.email],
              replyTo: {
                email: `${lastExchange.firstname.toLocaleLowerCase()}_${lastExchange.lastname.toLocaleLowerCase()}__${discussion.id}_e@reply.my-domain.com`,
                name: `${lastExchange.firstname} ${lastExchange.lastname} - ${discussion.businessName}`,
              },
              sender: discussionEmailSender,
              attachments: [],
            },
          ],
        });
      });

      it("sends email even if firstname or lastname has special caracters usually not supported in emails", async () => {
        const discussion = new DiscussionBuilder(
          discussionWithSiretAndAppellation,
        )
          .withPotentialBeneficiaryFirstname("É ric")
          .withPotentialBeneficiaryLastName("el Ah&é$truc")
          .withExchanges([
            firstBeneficiaryExchange,
            makeLastEstablishmentExchange("message", [
              { link: notABlobLink, name: "VCard" },
            ]),
            lastBeneficiaryExchange,
          ])
          .build();

        uow.discussionRepository.discussions = [discussion];

        await useCase.execute({
          discussionId: discussion.id,
        });

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "DISCUSSION_EXCHANGE",
              params: {
                htmlContent: expect.any(String),
                subject: lastBeneficiaryExchange.subject,
              },
              recipients: [admin.email, contact.email],
              replyTo: {
                email: `e-ric_el-ah-e-tru__${discussion.id}_b@reply.my-domain.com`,
                name: `${discussion.potentialBeneficiary.firstName} ${discussion.potentialBeneficiary.lastName}`,
              },
              sender: discussionEmailSender,
              attachments: [],
            },
          ],
        });
      });
    });
  });

  describe("wrong paths", () => {
    it("throws an error if the discussion does not exist", async () => {
      const discussionId = uuid();

      await expectPromiseToFailWithError(
        useCase.execute({ discussionId }),
        errors.discussion.notFound({ discussionId }),
      );
    });

    it("throws an error if appellation code does not exist", async () => {
      const discussion = new DiscussionBuilder(
        discussionWithSiretAndAppellation,
      )
        .withAppellationCode("20567")
        .withExchanges([firstBeneficiaryExchange])
        .build();

      uow.discussionRepository.discussions = [discussion];
      uow.romeRepository.appellations = [];

      await expectPromiseToFailWithError(
        useCase.execute({ discussionId: discussion.id }),
        errors.rome.missingAppellation({
          appellationCode: discussion.appellationCode,
        }),
      );
    });

    it("throws an error if discussion does not have exchanges", async () => {
      uow.discussionRepository.discussions = [
        discussionWithSiretAndAppellation,
      ];

      await expectPromiseToFailWithError(
        useCase.execute({ discussionId: discussionWithSiretAndAppellation.id }),
        errors.discussion.noExchanges(discussionWithSiretAndAppellation.id),
      );
    });

    describe("when last exchange is from potentialBeneficiary", () => {
      const discussionWithEstablishmentLastExchange = new DiscussionBuilder(
        discussionWithSiretAndAppellation,
      )
        .withExchanges([
          firstBeneficiaryExchange,
          makeLastEstablishmentExchange("", []),
          lastBeneficiaryExchange,
        ])
        .build();

      beforeEach(() => {
        uow.discussionRepository.discussions = [
          discussionWithEstablishmentLastExchange,
        ];
      });

      it("throws an error if missing establisment", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [];

        await expectPromiseToFailWithError(
          useCase.execute({
            discussionId: discussionWithSiretAndAppellation.id,
          }),
          errors.establishment.notFound({
            siret: discussionWithEstablishmentLastExchange.siret,
          }),
        );
      });

      it("throws an error if missing user", async () => {
        uow.userRepository.users = [];

        await expectPromiseToFailWithError(
          useCase.execute({
            discussionId: discussionWithEstablishmentLastExchange.id,
          }),
          errors.users.notFound({
            userIds: [admin.id, contact.id],
          }),
        );
      });
    });

    it("throws when user have pending right on establishment", async () => {
      // should never happen, establishment are supposed to have at least one admin with ACCEPTED right (changes made in the form establishment schema)

      uow.establishmentAggregateRepository.establishmentAggregates = [
        establishmentAggregateWithOnlyPendingUser,
      ];

      const discussion = new DiscussionBuilder(
        discussionWithSiretAndAppellation,
      )
        .withSiret(
          establishmentAggregateWithOnlyPendingUser.establishment.siret,
        )
        .withExchanges([firstBeneficiaryExchange, lastBeneficiaryExchange])
        .build();
      uow.discussionRepository.discussions = [discussion];

      await expectPromiseToFailWithError(
        useCase.execute({
          discussionId: discussion.id,
        }),
        errors.establishment.noContactToNotify({
          siret: discussion.siret,
        }),
      );
    });
  });
});
