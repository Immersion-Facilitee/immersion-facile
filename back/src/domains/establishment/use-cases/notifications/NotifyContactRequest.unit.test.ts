import {
  addressDtoToString,
  type ContactEstablishmentEventPayload,
  DiscussionBuilder,
  type DiscussionKind,
  discussionEmailSender,
  errors,
  expectPromiseToFailWithError,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  immersionDurationLabels,
  immersionFacileNoReplyEmailSender,
  makeRouteAbsoluteUrl,
  type PhoneNumber,
  UserBuilder,
} from "shared";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  EstablishmentAggregateBuilder,
  TEST_APPELLATION_CODE,
  TEST_APPELLATION_LABEL,
} from "../../helpers/EstablishmentBuilders";
import {
  makeNotifyContactRequest,
  type NotifyContactRequest,
} from "./NotifyContactRequest";

describe("NotifyContactRequest", () => {
  const domain = "reply.domain.com";
  const immersionFacileBaseUrl = "http://if";

  const establishmentAdmin = new UserBuilder()
    .withId("admin")
    .withEmail("admin@mail.com")
    .withFirstName("Jean")
    .withLastName("Dupont")
    .build();
  const establishmentContact = new UserBuilder()
    .withId("contact")
    .withEmail("contact@mail.com")
    .withFirstName("Marie")
    .withLastName("Martin")
    .build();
  const adminPhone: PhoneNumber = "+66355445544";

  const pendingUser = new UserBuilder()
    .withId("pending-user")
    .withEmail("pending-user@mail.com")
    .build();

  const establishmentAggregate = new EstablishmentAggregateBuilder()
    .withUserRights([
      {
        role: "establishment-admin",
        status: "ACCEPTED",
        job: "osef",
        phone: adminPhone,
        shouldReceiveDiscussionNotifications: true,
        userId: establishmentAdmin.id,
        isMainContactByPhone: false,
      },
      {
        role: "establishment-contact",
        status: "ACCEPTED",
        userId: establishmentContact.id,
        shouldReceiveDiscussionNotifications: true,
      },
      {
        role: "establishment-contact",
        status: "ACCEPTED",
        userId: "not-notified-user",
        shouldReceiveDiscussionNotifications: false,
      },
      {
        role: "establishment-contact",
        status: "PENDING",
        userId: pendingUser.id,
        shouldReceiveDiscussionNotifications: true,
      },
    ])
    .build();

  const establishmentAggregateWithContactPhone =
    new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("12345678901235")
      .withContactMode("PHONE")
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "osef",
          phone: adminPhone,
          shouldReceiveDiscussionNotifications: true,
          userId: establishmentAdmin.id,
          isMainContactByPhone: true,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: establishmentContact.id,
          shouldReceiveDiscussionNotifications: true,
        },
      ])
      .build();

  const establishmentAggregateWithContactPhoneNoPhone =
    new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("12345678901238")
      .withContactMode("PHONE")
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "osef",
          phone: "0600000000",
          shouldReceiveDiscussionNotifications: true,
          userId: establishmentAdmin.id,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: establishmentContact.id,
          shouldReceiveDiscussionNotifications: true,
        },
      ])
      .build();

  const establishmentAggregateWithContactInPerson =
    new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("12345678901236")
      .withContactMode("IN_PERSON")
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "osef",
          phone: adminPhone,
          shouldReceiveDiscussionNotifications: true,
          userId: establishmentAdmin.id,
          isMainContactByPhone: false,
        },
        {
          role: "establishment-contact",
          status: "ACCEPTED",
          userId: establishmentContact.id,
          shouldReceiveDiscussionNotifications: true,
          isMainContactInPerson: true,
        },
      ])
      .build();

  const establishmentAggregateWithContactInPersonNoContact =
    new EstablishmentAggregateBuilder()
      .withEstablishmentSiret("12345678901237")
      .withContactMode("IN_PERSON")
      .withUserRights([
        {
          role: "establishment-admin",
          status: "ACCEPTED",
          job: "osef",
          phone: adminPhone,
          shouldReceiveDiscussionNotifications: true,
          userId: establishmentAdmin.id,
          isMainContactByPhone: false,
        },
      ])
      .build();

  let uow: InMemoryUnitOfWork;
  let notifyContactRequest: NotifyContactRequest;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    notifyContactRequest = makeNotifyContactRequest({
      deps: {
        domain,
        immersionFacileBaseUrl,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          new CustomTimeGateway(),
        ),
      },
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    uow.romeRepository.appellations = [
      {
        appellationCode: TEST_APPELLATION_CODE,
        appellationLabel: TEST_APPELLATION_LABEL,
        romeCode: "A0000",
        romeLabel: "Rome de test",
      },
    ];
    uow.userRepository.users = [
      establishmentAdmin,
      establishmentContact,
      pendingUser,
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      establishmentAggregate,
      establishmentAggregateWithContactPhone,
      establishmentAggregateWithContactInPerson,
      establishmentAggregateWithContactPhoneNoPhone,
      establishmentAggregateWithContactInPersonNoContact,
    ];
  });

  describe("Right paths", () => {
    describe("Contact mode email", () => {
      it("Sends one CONTACT_BY_EMAIL_REQUEST_IMMERSION email per establishment user that is notified and has ACCEPTED rights", async () => {
        const discussion = new DiscussionBuilder()
          .withSiret(establishmentAggregate.establishment.siret)
          .withContactMode("EMAIL")
          .withDiscussionKind("IF")
          .withAppellationCode(TEST_APPELLATION_CODE)
          .build();

        uow.discussionRepository.discussions = [discussion];

        await notifyContactRequest.execute({
          discussionId: discussion.id,
          siret: discussion.siret,
        });

        if (discussion.kind !== "IF") throw new Error("discussion must be IF");

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "CONTACT_BY_EMAIL_REQUEST_IMMERSION",
              recipients: [establishmentAdmin.email],
              sender: discussionEmailSender,
              replyTo: {
                email: `${discussion.potentialBeneficiary.firstName}_${discussion.potentialBeneficiary.lastName}__${discussion.id}_b@reply.reply.domain.com`,
                name: `${getFormattedFirstnameAndLastname({ firstname: discussion.potentialBeneficiary.firstName, lastname: discussion.potentialBeneficiary.lastName })} - via Immersion Facilitée`,
              },
              params: {
                appellationLabel: TEST_APPELLATION_LABEL,
                businessAddress: addressDtoToString(discussion.address),
                businessName: discussion.businessName,
                contactFirstName: establishmentAdmin.firstName,
                contactLastName: establishmentAdmin.lastName,
                discussionUrl: makeRouteAbsoluteUrl({
                  route: frontRoutes.establishmentDashboardDiscussions({
                    discussionId: discussion.id,
                    at_campaign:
                      "inbound-parsing-reponse-via-espace-entreprise",
                    at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
                  }),
                  baseUrl: immersionFacileBaseUrl,
                }),
                immersionObjective:
                  discussion.potentialBeneficiary.immersionObjective ??
                  undefined,
                potentialBeneficiaryDatePreferences:
                  discussion.potentialBeneficiary.datePreferences,
                potentialBeneficiaryDurationPreferences:
                  immersionDurationLabels[
                    discussion.potentialBeneficiary.immersionDuration
                  ],
                potentialBeneficiaryExperienceAdditionalInformation:
                  discussion.potentialBeneficiary
                    .experienceAdditionalInformation,
                potentialBeneficiaryFirstName:
                  discussion.potentialBeneficiary.firstName,
                potentialBeneficiaryLastName:
                  discussion.potentialBeneficiary.lastName,
                potentialBeneficiaryMotivation:
                  discussion.potentialBeneficiary.motivation,
                potentialBeneficiaryPhone:
                  discussion.potentialBeneficiary.phone,
                potentialBeneficiaryResumeLink:
                  discussion.potentialBeneficiary.resumeLink,
              },
            },
            {
              kind: "CONTACT_BY_EMAIL_REQUEST_IMMERSION",
              recipients: [establishmentContact.email],
              sender: discussionEmailSender,
              replyTo: {
                email: `${discussion.potentialBeneficiary.firstName}_${discussion.potentialBeneficiary.lastName}__${discussion.id}_b@reply.reply.domain.com`,
                name: `${getFormattedFirstnameAndLastname({ firstname: discussion.potentialBeneficiary.firstName, lastname: discussion.potentialBeneficiary.lastName })} - via Immersion Facilitée`,
              },
              params: {
                appellationLabel: TEST_APPELLATION_LABEL,
                businessAddress: addressDtoToString(discussion.address),
                businessName: discussion.businessName,
                contactFirstName: establishmentContact.firstName,
                contactLastName: establishmentContact.lastName,
                discussionUrl: makeRouteAbsoluteUrl({
                  route: frontRoutes.establishmentDashboardDiscussions({
                    discussionId: discussion.id,
                    at_campaign:
                      "inbound-parsing-reponse-via-espace-entreprise",
                    at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
                  }),
                  baseUrl: immersionFacileBaseUrl,
                }),
                immersionObjective:
                  discussion.potentialBeneficiary.immersionObjective ??
                  undefined,
                potentialBeneficiaryDatePreferences:
                  discussion.potentialBeneficiary.datePreferences,
                potentialBeneficiaryDurationPreferences:
                  immersionDurationLabels[
                    discussion.potentialBeneficiary.immersionDuration
                  ],
                potentialBeneficiaryExperienceAdditionalInformation:
                  discussion.potentialBeneficiary
                    .experienceAdditionalInformation,
                potentialBeneficiaryFirstName:
                  discussion.potentialBeneficiary.firstName,
                potentialBeneficiaryLastName:
                  discussion.potentialBeneficiary.lastName,
                potentialBeneficiaryMotivation:
                  discussion.potentialBeneficiary.motivation,
                potentialBeneficiaryPhone:
                  discussion.potentialBeneficiary.phone,
                potentialBeneficiaryResumeLink:
                  discussion.potentialBeneficiary.resumeLink,
              },
            },
          ],
        });
      });

      it("Sends one CONTACT_BY_EMAIL_MINISTAGE email per establishment user that is notified and has ACCEPTED rights", async () => {
        const discussion = new DiscussionBuilder()
          .withSiret(establishmentAggregate.establishment.siret)
          .withContactMode("EMAIL")
          .withDiscussionKind("1_ELEVE_1_STAGE")
          .withAppellationCode(TEST_APPELLATION_CODE)
          .build();

        uow.discussionRepository.discussions = [discussion];

        await notifyContactRequest.execute({
          discussionId: discussion.id,
          siret: discussion.siret,
        });

        if (discussion.kind !== "1_ELEVE_1_STAGE")
          throw new Error("discussion must be 1_ELEVE_1_STAGE");

        expectSavedNotificationsAndEvents({
          emails: [
            {
              kind: "CONTACT_BY_EMAIL_MINISTAGE",
              recipients: [establishmentAdmin.email],
              sender: discussionEmailSender,
              replyTo: {
                email: `${discussion.potentialBeneficiary.firstName}_${discussion.potentialBeneficiary.lastName}__${discussion.id}_b@reply.reply.domain.com`,
                name: `${getFormattedFirstnameAndLastname({ firstname: discussion.potentialBeneficiary.firstName, lastname: discussion.potentialBeneficiary.lastName })} - via Immersion Facilitée`,
              },
              params: {
                appellationLabel: TEST_APPELLATION_LABEL,
                businessAddress: addressDtoToString(discussion.address),
                businessName: discussion.businessName,
                contactFirstName: establishmentAdmin.firstName,
                contactLastName: establishmentAdmin.lastName,
                discussionUrl: makeRouteAbsoluteUrl({
                  route: frontRoutes.establishmentDashboardDiscussions({
                    discussionId: discussion.id,
                    at_campaign:
                      "inbound-parsing-reponse-via-espace-entreprise",
                    at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
                  }),
                  baseUrl: immersionFacileBaseUrl,
                }),
                levelOfEducation:
                  discussion.potentialBeneficiary.levelOfEducation,
                potentialBeneficiaryDatePreferences:
                  discussion.potentialBeneficiary.datePreferences,
                potentialBeneficiaryFirstName:
                  discussion.potentialBeneficiary.firstName,
                potentialBeneficiaryLastName:
                  discussion.potentialBeneficiary.lastName,
                potentialBeneficiaryPhone:
                  discussion.potentialBeneficiary.phone,
              },
            },
            {
              kind: "CONTACT_BY_EMAIL_MINISTAGE",
              recipients: [establishmentContact.email],
              sender: discussionEmailSender,
              replyTo: {
                email: `${discussion.potentialBeneficiary.firstName}_${discussion.potentialBeneficiary.lastName}__${discussion.id}_b@reply.reply.domain.com`,
                name: `${getFormattedFirstnameAndLastname({ firstname: discussion.potentialBeneficiary.firstName, lastname: discussion.potentialBeneficiary.lastName })} - via Immersion Facilitée`,
              },
              params: {
                appellationLabel: TEST_APPELLATION_LABEL,
                businessAddress: addressDtoToString(discussion.address),
                businessName: discussion.businessName,
                contactFirstName: establishmentContact.firstName,
                contactLastName: establishmentContact.lastName,
                discussionUrl: makeRouteAbsoluteUrl({
                  route: frontRoutes.establishmentDashboardDiscussions({
                    discussionId: discussion.id,
                    at_campaign:
                      "inbound-parsing-reponse-via-espace-entreprise",
                    at_kwd: "inbound-parsing-reponse-via-espace-entreprise",
                  }),
                  baseUrl: immersionFacileBaseUrl,
                }),
                levelOfEducation:
                  discussion.potentialBeneficiary.levelOfEducation,
                potentialBeneficiaryDatePreferences:
                  discussion.potentialBeneficiary.datePreferences,
                potentialBeneficiaryFirstName:
                  discussion.potentialBeneficiary.firstName,
                potentialBeneficiaryLastName:
                  discussion.potentialBeneficiary.lastName,
                potentialBeneficiaryPhone:
                  discussion.potentialBeneficiary.phone,
              },
            },
          ],
        });
      });
    });

    describe("Contact mode phone", () => {
      it.each(["1_ELEVE_1_STAGE", "IF"] satisfies DiscussionKind[])(
        "Sends ContactByPhoneRequest email to potential beneficiary with an email kind %s",
        async () => {
          const discussion = new DiscussionBuilder()
            .withSiret(
              establishmentAggregateWithContactPhone.establishment.siret,
            )
            .withContactMode("PHONE")
            .withAppellationCode(TEST_APPELLATION_CODE)
            .build();

          uow.discussionRepository.discussions = [discussion];

          const validPhonePayload: ContactEstablishmentEventPayload = {
            discussionId: discussion.id,
            siret: discussion.siret,
          };

          await notifyContactRequest.execute(validPhonePayload);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "CONTACT_BY_PHONE_INSTRUCTIONS",
                recipients: [discussion.potentialBeneficiary.email],
                sender: immersionFacileNoReplyEmailSender,
                params: {
                  businessName: discussion.businessName,
                  contactFirstName: getFormattedFirstnameAndLastname({
                    firstname: establishmentAdmin.firstName,
                  }),
                  contactLastName: getFormattedFirstnameAndLastname({
                    lastname: establishmentAdmin.lastName,
                  }),
                  contactPhone: adminPhone,
                  kind: discussion.kind,
                  potentialBeneficiaryFirstName:
                    getFormattedFirstnameAndLastname({
                      firstname: discussion.potentialBeneficiary.firstName,
                    }),
                  potentialBeneficiaryLastName:
                    getFormattedFirstnameAndLastname({
                      lastname: discussion.potentialBeneficiary.lastName,
                    }),
                },
              },
            ],
          });
        },
      );
    });

    describe("Contact mode in person", () => {
      it.each(["1_ELEVE_1_STAGE", "IF"] satisfies DiscussionKind[])(
        "Sends ContactInPersonRequest email to potential beneficiary with an email kind %s ",
        async () => {
          const discussion = new DiscussionBuilder()
            .withSiret(
              establishmentAggregateWithContactInPerson.establishment.siret,
            )
            .withContactMode("IN_PERSON")
            .withAppellationCode(TEST_APPELLATION_CODE)
            .build();

          uow.discussionRepository.discussions = [discussion];

          const validInPersonPayload: ContactEstablishmentEventPayload = {
            discussionId: discussion.id,
            siret: discussion.siret,
          };

          await notifyContactRequest.execute(validInPersonPayload);

          expectSavedNotificationsAndEvents({
            emails: [
              {
                kind: "CONTACT_IN_PERSON_INSTRUCTIONS",
                recipients: [discussion.potentialBeneficiary.email],
                sender: immersionFacileNoReplyEmailSender,
                params: {
                  businessName: discussion.businessName,
                  contactFirstName: getFormattedFirstnameAndLastname({
                    firstname: establishmentContact.firstName,
                  }),
                  contactLastName: getFormattedFirstnameAndLastname({
                    lastname: establishmentContact.lastName,
                  }),
                  welcomeAddress: addressDtoToString(discussion.address),
                  kind: discussion.kind,
                  potentialBeneficiaryFirstName:
                    getFormattedFirstnameAndLastname({
                      firstname: discussion.potentialBeneficiary.firstName,
                    }),
                  potentialBeneficiaryLastName:
                    getFormattedFirstnameAndLastname({
                      lastname: discussion.potentialBeneficiary.lastName,
                    }),
                },
              },
            ],
          });
        },
      );
    });
  });

  describe("wrong paths", () => {
    it("Missing discussion", async () => {
      const missingDiscussionId = new UuidV4Generator().new();

      await expectPromiseToFailWithError(
        notifyContactRequest.execute({
          discussionId: missingDiscussionId,
          siret: "12345678901234",
        }),
        errors.discussion.notFound({
          discussionId: missingDiscussionId,
        }),
      );
    });

    it("Bad immersion offer with contactMode EMAIL", async () => {
      const discussion = new DiscussionBuilder()
        .withSiret(establishmentAggregate.establishment.siret)
        .withContactMode("EMAIL")
        .withAppellationCode(TEST_APPELLATION_CODE)
        .build();

      uow.discussionRepository.discussions = [discussion];
      uow.romeRepository.appellations = [];

      await expectPromiseToFailWithError(
        notifyContactRequest.execute({
          discussionId: discussion.id,
          siret: discussion.siret,
        }),
        errors.rome.missingAppellation({
          appellationCode: discussion.appellationCode,
        }),
      );
    });
    it("No user right to contact (isMainContactByPhone false) with contactMode PHONE", async () => {
      const discussion = new DiscussionBuilder()
        .withSiret(
          establishmentAggregateWithContactPhoneNoPhone.establishment.siret,
        )
        .withContactMode("PHONE")
        .withAppellationCode(TEST_APPELLATION_CODE)
        .build();

      uow.discussionRepository.discussions = [discussion];

      await expectPromiseToFailWithError(
        notifyContactRequest.execute({
          discussionId: discussion.id,
          siret: discussion.siret,
        }),
        errors.establishment.contactUserNotFound({
          siret: discussion.siret,
        }),
      );
    });
    it("No user right to contact (isMainContactInPerson false) with contactMode IN_PERSON", async () => {
      const discussion = new DiscussionBuilder()
        .withSiret(
          establishmentAggregateWithContactInPersonNoContact.establishment
            .siret,
        )
        .withContactMode("IN_PERSON")
        .withAppellationCode(TEST_APPELLATION_CODE)
        .build();

      uow.discussionRepository.discussions = [discussion];

      await expectPromiseToFailWithError(
        notifyContactRequest.execute({
          discussionId: discussion.id,
          siret: discussion.siret,
        }),
        errors.establishment.contactUserNotFound({
          siret: discussion.siret,
        }),
      );
    });
  });
});
