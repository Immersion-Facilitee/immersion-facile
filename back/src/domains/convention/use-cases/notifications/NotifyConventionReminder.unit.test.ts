import {
  type AbsoluteUrl,
  AgencyDtoBuilder,
  type AgencyWithUsersRights,
  ConnectedUserBuilder,
  type ConventionActorRole,
  type ConventionDto,
  ConventionDtoBuilder,
  conventionStatuses,
  defaultPhoneNumber,
  type EstablishmentRepresentative,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  frontRoutes,
  type GenericActor,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type ReminderKind,
  splitCasesBetweenPassingAndFailing,
  type TemplatedEmail,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import { makeShortLinkUrl } from "../../../core/short-link/ShortLink";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyConventionReminder,
  type NotifyConventionReminder,
  toSignatoriesSummary,
} from "./NotifyConventionReminder";

describe("NotifyConventionReminder use case", () => {
  const establishmentRepresentativeWithoutMobilePhone: EstablishmentRepresentative =
    {
      email: "boss@mail.com",
      firstName: "lord",
      lastName: "voldemort",
      phone: "+33188776666",
      role: "establishment-representative",
    };
  let useCase: NotifyConventionReminder;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let shortLinkIdGeneratorGateway: DeterministShortLinkIdGeneratorGateway;
  let config: AppConfig;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    config = new AppConfigBuilder().build();
    timeGateway = new CustomTimeGateway();
    shortLinkIdGeneratorGateway = new DeterministShortLinkIdGeneratorGateway();
    uow = createInMemoryUow();

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );

    useCase = makeNotifyConventionReminder({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        config,
        timeGateway,
        shortLinkIdGeneratorGateway,
        generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
      },
    });
  });

  describe("Wrong paths", () => {
    it("Missing convention", async () => {
      //Arrange
      const convention = new ConventionDtoBuilder().build();
      uow.conventionRepository.setConventions([]);

      //Act
      await expectPromiseToFailWithError(
        useCase.execute({
          conventionId: convention.id,
          reminderKind: "FirstReminderForAgency",
        }),
        errors.convention.notFound({ conventionId: convention.id }),
      );

      //Assert
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });

    it("Missing agency", async () => {
      //Arrange
      const convention = new ConventionDtoBuilder().build();
      uow.conventionRepository.setConventions([convention]);

      //Act
      await expectPromiseToFailWithError(
        useCase.execute({
          conventionId: convention.id,
          reminderKind: "FirstReminderForAgency",
        }),
        errors.agency.notFound({ agencyId: convention.agencyId }),
      );

      //Assert
      expectSavedNotificationsAndEvents({
        emails: [],
      });
    });
  });

  describe("Agency reminders", () => {
    const [authorizedAgencyStatuses, forbiddenAgencyStatuses] =
      splitCasesBetweenPassingAndFailing(conventionStatuses, ["IN_REVIEW"]);

    const councellor1 = new ConnectedUserBuilder()
      .withId("counsellor1")
      .withEmail("councellor1@email.com")
      .buildUser();
    const councellor2 = new ConnectedUserBuilder()
      .withId("counsellor2")
      .withEmail("councellor2@email.com")
      .buildUser();
    const validator1 = new ConnectedUserBuilder()
      .withId("validator1")
      .withEmail("validator1@email.com")
      .buildUser();
    const validator2 = new ConnectedUserBuilder()
      .withId("validator2")
      .withEmail("validator2@email.com")
      .buildUser();
    const agencyWithRight = toAgencyWithRights(
      new AgencyDtoBuilder().withId("agencyId").build(),
      {
        [councellor1.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor"],
        },
        [councellor2.id]: {
          isNotifiedByEmail: true,
          roles: ["counsellor"],
        },
        [validator1.id]: {
          isNotifiedByEmail: true,
          roles: ["validator", "counsellor"],
        },
        [validator2.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      },
    );

    beforeEach(() => {
      uow.userRepository.users = [
        councellor1,
        councellor2,
        validator1,
        validator2,
      ];
      uow.agencyRepository.agencies = [agencyWithRight];
    });

    describe("FirstReminderForAgency", () => {
      it.each(authorizedAgencyStatuses)(
        `Send email 'FirstReminderForAgency' to counsellors and validators when status is '%s'`,
        async (status) => {
          //Arrange
          const convention = new ConventionDtoBuilder()
            .withAgencyId(agencyWithRight.id)
            .withStatus(status)
            .build();
          uow.conventionRepository.setConventions([convention]);

          //Act
          await useCase.execute({
            conventionId: convention.id,
            reminderKind: "FirstReminderForAgency",
          });

          //Assert

          const manageConventionLink: AbsoluteUrl = makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: config.immersionFacileBaseUrl,
          });

          expectSavedNotificationsAndEvents({
            emails: [
              makeAgencyFirstReminderEmail({
                email: validator1.email,
                agency: agencyWithRight,
                convention,
                manageConventionLink,
              }),
              makeAgencyFirstReminderEmail({
                email: validator2.email,
                agency: agencyWithRight,
                convention,
                manageConventionLink,
              }),
              makeAgencyFirstReminderEmail({
                email: councellor1.email,
                agency: agencyWithRight,
                convention,
                manageConventionLink,
              }),
              makeAgencyFirstReminderEmail({
                email: councellor2.email,
                agency: agencyWithRight,
                convention,
                manageConventionLink,
              }),
            ],
          });
        },
      );

      describe("Forbidden cases on convention bad status", () => {
        it.each(forbiddenAgencyStatuses)("status '%s'", async (status) => {
          //Arrange
          const convention = new ConventionDtoBuilder()
            .withAgencyId(agencyWithRight.id)
            .withStatus(status)
            .build();
          uow.conventionRepository.setConventions([convention]);

          const kind: ReminderKind = "FirstReminderForAgency";

          //Act & Assert
          await expectPromiseToFailWithError(
            useCase.execute({
              conventionId: convention.id,
              reminderKind: kind,
            }),
            errors.convention.forbiddenReminder({ convention, kind }),
          );
          expectSavedNotificationsAndEvents({
            emails: [],
          });
        });
      });
    });

    describe("LastReminderForAgency", () => {
      it.each(authorizedAgencyStatuses)(
        "Send email 'LastReminderForAgency' to counsellors and validators when status is '%s'",
        async (status) => {
          //Arrange
          const convention = new ConventionDtoBuilder()
            .withAgencyId(agencyWithRight.id)
            .withStatus(status)
            .build();
          uow.conventionRepository.setConventions([convention]);

          //Act
          await useCase.execute({
            conventionId: convention.id,
            reminderKind: "LastReminderForAgency",
          });

          //Assert

          const manageConventionLink: AbsoluteUrl = makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: config.immersionFacileBaseUrl,
          });

          expectSavedNotificationsAndEvents({
            emails: [
              makeAgencyLastReminderEmail({
                email: validator1.email,
                convention,
                manageConventionLink,
              }),
              makeAgencyLastReminderEmail({
                email: validator2.email,
                convention,
                manageConventionLink,
              }),
              makeAgencyLastReminderEmail({
                email: councellor1.email,
                convention,
                manageConventionLink,
              }),
              makeAgencyLastReminderEmail({
                email: councellor2.email,
                convention,
                manageConventionLink,
              }),
            ],
          });
        },
      );

      describe("Forbidden cases on convention bad status", () => {
        it.each(forbiddenAgencyStatuses)("status '%s'", async (status) => {
          //Arrange
          const convention = new ConventionDtoBuilder()
            .withAgencyId(agencyWithRight.id)
            .withStatus(status)
            .build();
          uow.conventionRepository.setConventions([convention]);

          const kind: ReminderKind = "FirstReminderForAgency";
          //Act
          await expectPromiseToFailWithError(
            useCase.execute({
              conventionId: convention.id,
              reminderKind: kind,
            }),
            errors.convention.forbiddenReminder({ convention, kind }),
          );

          //Assert
          expectSavedNotificationsAndEvents({
            emails: [],
          });
        });
      });
    });
  });

  describe("Signatories reminder", () => {
    const [authorizedSignatoryStatuses, forbiddenSignatoryStatuses] =
      splitCasesBetweenPassingAndFailing(conventionStatuses, [
        "PARTIALLY_SIGNED",
        "READY_TO_SIGN",
      ]);

    const kind: ReminderKind = "ReminderForSignatories";

    it.each(authorizedSignatoryStatuses)(
      `Send email 'ReminderForSignatories' to signatories when status is '%s'.
            Convention with same establishment representative & tutor`,
      async (status) => {
        //Arrange
        const agency = new AgencyDtoBuilder().withId("agencyId").build();

        const convention = new ConventionDtoBuilder()
          .withAgencyId(agency.id)
          .withStatus(status)
          .withEstablishmentRepresentative(
            establishmentRepresentativeWithoutMobilePhone,
          )
          .withEstablishmentTutor({
            email: establishmentRepresentativeWithoutMobilePhone.email,
            firstName: establishmentRepresentativeWithoutMobilePhone.firstName,
            lastName: establishmentRepresentativeWithoutMobilePhone.lastName,
            job: "wizard",
            phone: establishmentRepresentativeWithoutMobilePhone.phone,
            role: "establishment-tutor",
          })
          .build();
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
        const shortLinkIds = ["link1", "link2"];
        shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinkIds);

        //Act
        await useCase.execute({
          conventionId: convention.id,
          reminderKind: kind,
        });

        //Assert
        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: shortLinkIds[0],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.beneficiary.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.beneficiary.email,
              now: timeGateway.now(),
            }),
            lastUsedAt: null,
          },
          {
            id: shortLinkIds[1],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.establishmentRepresentative.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.establishmentRepresentative.email,
              now: timeGateway.now(),
            }),
            lastUsedAt: null,
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.beneficiary,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[0]),
            }),
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.establishmentRepresentative,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[1]),
            }),
          ],
        });
      },
    );

    it.each(authorizedSignatoryStatuses)(
      `Send email 'ReminderForSignatories' to signatories when status is '%s'.
            Convention with different establishment representative & tutor.
            SMS are sent only for signatories that have not signed yet and have mobile phone.`,
      async (status) => {
        //Arrange
        const agency = new AgencyDtoBuilder().withId("agencyId").build();

        const convention = new ConventionDtoBuilder()
          .withAgencyId(agency.id)
          .withStatus(status)
          .withEstablishmentRepresentativePhone("+33611448866")
          .withEstablishmentRepresentativeSignedAt(undefined)
          .withEstablishmentTutor({
            email: "tutor@email.com",
            firstName: "Obiwan",
            lastName: "Kenobi",
            job: "Jedi Master",
            phone: "+33688997755",
            role: "establishment-tutor",
          })
          .build();
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
        const shortLinkIds = ["link1", "link2", "link3"];
        shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinkIds);

        //Act
        await useCase.execute({
          conventionId: convention.id,
          reminderKind: kind,
        });

        //Assert
        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: shortLinkIds[0],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.beneficiary.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.beneficiary.email,
              now: timeGateway.now(),
            }),

            lastUsedAt: null,
          },
          {
            id: shortLinkIds[1],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.establishmentRepresentative.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.establishmentRepresentative.email,
              now: timeGateway.now(),
            }),

            lastUsedAt: null,
          },
          {
            id: shortLinkIds[2],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.establishmentRepresentative.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.establishmentRepresentative.email,
              now: timeGateway.now(),
            }),

            lastUsedAt: null,
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.beneficiary,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[0]),
            }),
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.establishmentRepresentative,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[1]),
            }),
            makeSignatoriesLastReminderEmail({
              actor: convention.establishmentTutor,
              convention,
              shortlinkUrl: undefined,
            }),
          ],
          sms: [
            {
              recipientPhone:
                convention.signatories.establishmentRepresentative.phone,
              kind,
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkIds[2]),
              },
            },
          ],
        });
      },
    );

    describe("Forbidden cases on convention bad status", () => {
      it.each(forbiddenSignatoryStatuses)("status '%s'", async (status) => {
        //Arrange
        const agency = new AgencyDtoBuilder().withId("agencyId").build();
        const convention = new ConventionDtoBuilder()
          .withAgencyId(agency.id)
          .withStatus(status)
          .build();
        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

        //Act & Assert
        await expectPromiseToFailWithError(
          useCase.execute({
            conventionId: convention.id,
            reminderKind: kind,
          }),
          errors.convention.forbiddenReminder({ convention, kind }),
        );
        expectSavedNotificationsAndEvents({});
      });
    });
  });

  describe("toSignatoriesSummary", () => {
    it("should return the given text array if we only have a beneficiary and an establishment representative", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryFirstName("Jean")
        .withBeneficiaryLastName("Valjean")
        .withBeneficiarySignedAt(new Date("2023-03-15"))
        .withEstablishmentRepresentativeFirstName("Louis")
        .withEstablishmentRepresentativeLastName("de la Valière")
        .withEstablishmentRepresentativeSignedAt(undefined)
        .withBusinessName("Paris Corp")
        .build();

      const expected: string[] = [
        "- √  - A signé le 15/03/2023 - Jean Valjean, bénéficiaire",
        `- ❌ - N'a pas signé - Louis de la Valière, représentant l'entreprise Paris Corp`,
      ];

      expect(toSignatoriesSummary(convention)).toStrictEqual(expected);
    });

    it("should return the given text array if we have a minor beneficiary with a representative and an establishment representative", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryFirstName("Jean")
        .withBeneficiaryLastName("Valjean")
        .withBeneficiarySignedAt(new Date("2023-03-19"))
        .withEstablishmentRepresentativeFirstName("Louis")
        .withEstablishmentRepresentativeLastName("de la Valière")
        .withEstablishmentRepresentativeSignedAt(undefined)
        .withBusinessName("Paris Corp")
        .withBeneficiaryRepresentative({
          email: "",
          firstName: "Révérent",
          lastName: "Balec",
          phone: "",
          role: "beneficiary-representative",
          signedAt: new Date("2023-03-19").toDateString(),
        })
        .build();

      const expected: string[] = [
        "- √  - A signé le 19/03/2023 - Jean Valjean, bénéficiaire",
        "- √  - A signé le 19/03/2023 - Révérent Balec, représentant légal du bénéficiaire",
        `- ❌ - N'a pas signé - Louis de la Valière, représentant l'entreprise Paris Corp`,
      ];

      expect(toSignatoriesSummary(convention)).toStrictEqual(expected);
    });

    it("should return the given text array if we have a beneficiary with a current employer and an establishment representative", () => {
      const convention = new ConventionDtoBuilder()
        .withBeneficiaryFirstName("Jean")
        .withBeneficiaryLastName("Valjean")
        .withBeneficiarySignedAt(new Date("2023-03-19"))
        .withEstablishmentRepresentativeFirstName("Louis")
        .withEstablishmentRepresentativeLastName("de la Valière")
        .withEstablishmentRepresentativeSignedAt(undefined)
        .withBusinessName("Paris Corp")
        .withBeneficiaryCurrentEmployer({
          email: "",
          firstName: "Robert",
          lastName: "Thénardier",
          phone: "",
          role: "beneficiary-current-employer",
          businessName: "",
          businessSiret: "",
          job: "",
          signedAt: undefined,
          businessAddress: "Rue des Bouchers 67065 Strasbourg",
        })
        .build();

      const expected: string[] = [
        "- √  - A signé le 19/03/2023 - Jean Valjean, bénéficiaire",
        `- ❌ - N'a pas signé - Robert Thénardier, employeur actuel du bénéficiaire`,
        `- ❌ - N'a pas signé - Louis de la Valière, représentant l'entreprise Paris Corp`,
      ];

      expect(toSignatoriesSummary(convention)).toStrictEqual(expected);
    });
  });

  describe("handle SMS DOM", () => {
    it.each([
      ["+33600000002"], // Metropole
      ["+262639000001"], // Mayotte
      ["+590690000001"], // Guadeloupe
      ["+594694000001"], // Guyane
      ["+596696000001"], // Martinique
      ["+262692000001"], // Réunion
      ["+262693000001"], // Réunion
    ])(
      "Should send SMS with mobile phone %s",
      async (internationalMobilePhone) => {
        //Arrange
        const agency = new AgencyDtoBuilder().withId("agencyId").build();

        const convention = new ConventionDtoBuilder()
          .withAgencyId(agency.id)
          .withStatus("READY_TO_SIGN")
          .withBeneficiaryPhone(internationalMobilePhone)
          .withBeneficiarySignedAt(undefined)
          .withEstablishmentRepresentativePhone("+262693000002")
          .build();

        uow.conventionRepository.setConventions([convention]);
        uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

        const shortLinkIds = ["link1", "link2", "link3"];
        shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinkIds);

        //Act
        await useCase.execute({
          conventionId: convention.id,
          reminderKind: "ReminderForSignatories",
        });

        //Assert
        expectToEqual(uow.shortLinkQuery.getShortLinks(), [
          {
            id: shortLinkIds[0],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.beneficiary.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.beneficiary.email,
              now: timeGateway.now(),
            }),
            lastUsedAt: null,
          },
          {
            id: shortLinkIds[1],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.establishmentRepresentative.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.establishmentRepresentative.email,
              now: timeGateway.now(),
            }),
            lastUsedAt: null,
          },
          {
            id: shortLinkIds[2],
            url: fakeGenerateMagicLinkUrlFn({
              id: convention.id,
              role: convention.signatories.beneficiary.role,
              targetRoute: "conventionToSign",
              email: convention.signatories.beneficiary.email,
              now: timeGateway.now(),
            }),

            lastUsedAt: null,
          },
        ]);

        expectSavedNotificationsAndEvents({
          emails: [
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.beneficiary,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[0]),
            }),
            makeSignatoriesLastReminderEmail({
              actor: convention.signatories.establishmentRepresentative,
              convention,
              shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[1]),
            }),
            makeSignatoriesLastReminderEmail({
              actor: convention.establishmentTutor,
              convention,
              shortlinkUrl: undefined,
            }),
          ],
          sms: [
            {
              kind: "ReminderForSignatories",
              recipientPhone: internationalMobilePhone,
              params: {
                shortLink: makeShortLinkUrl(config, shortLinkIds[2]),
              },
            },
          ],
        });
      },
    );

    it("should not send SMS to beneficiary if he has default phone number", async () => {
      const agency = new AgencyDtoBuilder().withId("agencyId").build();
      const convention = new ConventionDtoBuilder()
        .withAgencyId(agency.id)
        .withStatus("READY_TO_SIGN")
        .withBeneficiaryPhone(defaultPhoneNumber)
        .withBeneficiarySignedAt(undefined)
        .withEstablishmentRepresentativePhone("+262693000002")
        .build();
      uow.conventionRepository.setConventions([convention]);
      uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

      const shortLinkIds = ["link1", "link2"];
      shortLinkIdGeneratorGateway.addMoreShortLinkIds(shortLinkIds);

      await useCase.execute({
        conventionId: convention.id,
        reminderKind: "ReminderForSignatories",
      });

      expectToEqual(uow.shortLinkQuery.getShortLinks(), [
        {
          id: shortLinkIds[0],
          url: fakeGenerateMagicLinkUrlFn({
            id: convention.id,
            role: convention.signatories.beneficiary.role,
            targetRoute: "conventionToSign",
            email: convention.signatories.beneficiary.email,
            now: timeGateway.now(),
          }),

          lastUsedAt: null,
        },
        {
          id: shortLinkIds[1],
          url: fakeGenerateMagicLinkUrlFn({
            id: convention.id,
            role: convention.signatories.establishmentRepresentative.role,
            targetRoute: "conventionToSign",
            email: convention.signatories.establishmentRepresentative.email,
            now: timeGateway.now(),
          }),
          lastUsedAt: null,
        },
      ]);

      expectSavedNotificationsAndEvents({
        emails: [
          makeSignatoriesLastReminderEmail({
            actor: convention.signatories.beneficiary,
            convention,
            shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[0]),
          }),
          makeSignatoriesLastReminderEmail({
            actor: convention.signatories.establishmentRepresentative,
            convention,
            shortlinkUrl: makeShortLinkUrl(config, shortLinkIds[1]),
          }),
          makeSignatoriesLastReminderEmail({
            actor: convention.establishmentTutor,
            convention,
            shortlinkUrl: undefined,
          }),
        ],
        sms: [],
      });
    });
  });
});

const makeAgencyFirstReminderEmail = ({
  email,
  agency,
  convention,
  manageConventionLink,
}: {
  email: string;
  agency: AgencyWithUsersRights;
  convention: ConventionDto;
  manageConventionLink: AbsoluteUrl;
}): TemplatedEmail => ({
  kind: "AGENCY_FIRST_REMINDER",
  recipients: [email],
  params: {
    agencyReferentName: getFormattedFirstnameAndLastname(
      convention.agencyReferent ?? {},
    ),
    conventionId: convention.id,
    agencyName: agency.name,
    beneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
    }),
    beneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: convention.signatories.beneficiary.lastName,
    }),
    businessName: convention.businessName,
    dateStart: convention.dateStart,
    dateEnd: convention.dateEnd,
    manageConventionLink,
  },
});

const makeAgencyLastReminderEmail = ({
  email,
  convention,
  manageConventionLink,
}: {
  email: string;
  convention: ConventionDto;
  manageConventionLink: AbsoluteUrl;
}): TemplatedEmail => ({
  kind: "AGENCY_LAST_REMINDER",
  recipients: [email],
  params: {
    conventionId: convention.id,
    agencyReferentName: getFormattedFirstnameAndLastname(
      convention.agencyReferent ?? {},
    ),
    beneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
    }),
    beneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: convention.signatories.beneficiary.lastName,
    }),
    businessName: convention.businessName,
    manageConventionLink,
  },
});

const makeSignatoriesLastReminderEmail = ({
  actor,
  convention,
  shortlinkUrl,
}: {
  actor: GenericActor<ConventionActorRole>;
  convention: ConventionDto;
  shortlinkUrl: AbsoluteUrl | undefined;
}): TemplatedEmail => ({
  kind: "SIGNATORY_REMINDER",
  recipients: [actor.email],
  params: {
    conventionId: convention.id,
    actorFirstName: getFormattedFirstnameAndLastname({
      firstname: actor.firstName,
    }),
    actorLastName: getFormattedFirstnameAndLastname({
      lastname: actor.lastName,
    }),
    beneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
    }),
    beneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: convention.signatories.beneficiary.lastName,
    }),
    businessName: convention.businessName,
    signatoriesSummary: toSignatoriesSummary(convention).join("\n"),
    magicLinkUrl: shortlinkUrl,
  },
});
