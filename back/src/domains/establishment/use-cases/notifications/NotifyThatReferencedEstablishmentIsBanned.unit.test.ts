import { addDays, subDays } from "date-fns";
import {
  AgencyDtoBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  DiscussionBuilder,
  errors,
  expectPromiseToFailWithError,
  reasonableSchedule,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import type { FtConnectImmersionAdvisorDto } from "../../../core/authentication/ft-connect/dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../../core/authentication/ft-connect/dto/FtConnectUserDto";
import {
  makeSaveNotificationAndRelatedEvent,
  type SaveNotificationAndRelatedEvent,
} from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  makeNotifyThatReferencedEstablishmentIsBanned,
  type NotifyThatReferencedEstablishmentIsBanned,
} from "./NotifyThatReferencedEstablishmentIsBanned";

const immersionBaseUrl = "https://immersion-facile.beta.gouv.fr";

describe("NotifyThatReferencedEstablishmentIsBanned", () => {
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  let notifyThatReferencedEstablishmentIsBanned: NotifyThatReferencedEstablishmentIsBanned;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  const adminUser = new UserBuilder()
    .withId("admin-id")
    .withEmail("admin@company.com")
    .build();

  const contactUser = new UserBuilder()
    .withId("contact-id")
    .withEmail("contact@company.com")
    .build();

  const pendingContactUser = new UserBuilder()
    .withId("pending-contact-id")
    .withEmail("pending.contact@company.com")
    .build();

  const validator1 = new UserBuilder()
    .withId("validator1-id")
    .withEmail("validator1@company.com")
    .build();

  const validator2 = new UserBuilder()
    .withId("validator2-id")
    .withEmail("validator2@company.com")
    .build();

  const counsellor1 = new UserBuilder()
    .withId("counsellor1-id")
    .withEmail("counsellor1@company.com")
    .build();

  const counsellor2 = new UserBuilder()
    .withId("counsellor2-id")
    .withEmail("counsellor2@company.com")
    .build();

  const agency = new AgencyDtoBuilder()
    .withId("agency-id")
    .withName("Agence validatrice")
    .withAgencyContactEmail("agency@company.com")
    .build();

  const agencyWithRefersToAgency = new AgencyDtoBuilder()
    .withRefersToAgencyInfo({
      refersToAgencyId: agency.id,
      refersToAgencyName: agency.name,
      refersToAgencyContactEmail: agency.contactEmail,
    })
    .build();

  const bannedEstablishmentAggregate = new EstablishmentAggregateBuilder()
    .withUserRights([
      {
        role: "establishment-admin",
        userId: adminUser.id,
        status: "ACCEPTED",
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
        job: "CEO",
        phone: "0600000000",
      },
      {
        role: "establishment-contact",
        userId: contactUser.id,
        status: "ACCEPTED",
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
        job: "HR",
        phone: "0600000001",
      },
      {
        role: "establishment-contact",
        userId: pendingContactUser.id,
        status: "PENDING",
        shouldReceiveDiscussionNotifications: true,
        isMainContactByPhone: false,
        job: "Manager",
        phone: "0600000002",
      },
    ])
    .withBannishmentInformations({
      isEstablishmentBanned: true,
      establishmentBannishmentJustification:
        "Ils font de la pêche à pied intensive dans la baie de Saint-Brieuc",
    })
    .build();

  const siret = bannedEstablishmentAggregate.establishment.siret;
  const businessName = bannedEstablishmentAggregate.establishment.name;

  const pendingDiscussion = new DiscussionBuilder()
    .withSiret(siret)
    .withStatus({ status: "PENDING" })
    .withPotentialBeneficiaryEmail("pending-beneficiary@test.com")
    .build();

  let validatedConvention: ConventionDto;

  let validatedConventionWithRefersToAgency: ConventionDto;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      new UuidV4Generator(),
      new CustomTimeGateway(),
    );
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    notifyThatReferencedEstablishmentIsBanned =
      makeNotifyThatReferencedEstablishmentIsBanned({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent,
          immersionBaseUrl,
          timeGateway,
        },
      });

    validatedConvention = new ConventionDtoBuilder()
      .withId("eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee")
      .withSiret(bannedEstablishmentAggregate.establishment.siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withBeneficiaryEmail("beneficiary-validated@test.com")
      .withDateStart(subDays(timeGateway.now(), 1).toISOString())
      .withDateEnd(addDays(timeGateway.now(), 1).toISOString())
      .withSchedule(reasonableSchedule)
      .withAgencyId(agency.id)
      .build();

    validatedConventionWithRefersToAgency = new ConventionDtoBuilder()
      .withId("ffffffff-ffff-4fff-afff-ffffffffffff")
      .withSiret(bannedEstablishmentAggregate.establishment.siret)
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withBeneficiaryEmail("beneficiary-validated@test.com")
      .withDateStart(subDays(timeGateway.now(), 1).toISOString())
      .withDateEnd(addDays(timeGateway.now(), 1).toISOString())
      .withSchedule(reasonableSchedule)
      .withAgencyId(agencyWithRefersToAgency.id)
      .build();

    uow.userRepository.users = [
      adminUser,
      contactUser,
      pendingContactUser,
      validator1,
      validator2,
      counsellor1,
      counsellor2,
    ];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      bannedEstablishmentAggregate,
    ];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
        [validator2.id]: { roles: ["validator"], isNotifiedByEmail: false },
      }),
      toAgencyWithRights(agencyWithRefersToAgency, {
        [validator1.id]: { roles: ["validator"], isNotifiedByEmail: true },
        [validator2.id]: { roles: ["validator"], isNotifiedByEmail: false },
        [counsellor1.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
        [counsellor2.id]: { roles: ["counsellor"], isNotifiedByEmail: false },
      }),
    ];
  });

  describe("Wrong path", () => {
    it("throws when establishment is not banned", async () => {
      const notBannedEstablishment = new EstablishmentAggregateBuilder(
        bannedEstablishmentAggregate,
      )
        .withBannishmentInformations({ isEstablishmentBanned: false })
        .build();

      uow.establishmentAggregateRepository.establishmentAggregates = [
        notBannedEstablishment,
      ];

      await expectPromiseToFailWithError(
        notifyThatReferencedEstablishmentIsBanned.execute({
          siret: notBannedEstablishment.establishment.siret,
        }),
        errors.establishment.establishmentNotBanned({
          siret: notBannedEstablishment.establishment.siret,
        }),
      );
    });
  });

  describe("Right path", () => {
    it("returns nothing if establishment is not registered", async () => {
      expect(() =>
        notifyThatReferencedEstablishmentIsBanned.execute({
          siret: "00000000000000",
        }),
      ).not.toThrow();

      expectSavedNotificationsAndEvents({
        emails: [],
        sms: [],
      });
    });

    it("sends emails to accepted admin and contact users only", async () => {
      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
        ],
      });
    });

    it("sends emails to pending discussion beneficiaries only", async () => {
      const acceptedDiscussion = new DiscussionBuilder()
        .withId("bbbbbbbb-bbbb-4444-bbbb-bbbbbbbbbbbb")
        .withSiret(siret)
        .withStatus({ status: "ACCEPTED", candidateWarnedMethod: "email" })
        .withPotentialBeneficiaryEmail("accepted-beneficiary@test.com")
        .build();

      uow.discussionRepository.discussions = [
        pendingDiscussion,
        acceptedDiscussion,
      ];

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
            recipients: [pendingDiscussion.potentialBeneficiary.email],
            params: {
              businessName,
              beneficiaryFirstName:
                pendingDiscussion.potentialBeneficiary.firstName,
              beneficiaryLastName:
                pendingDiscussion.potentialBeneficiary.lastName,
              immersionBaseUrl,
            },
          },
        ],
      });
    });

    it("sends no discussion beneficiary email when there are no pending discussions", async () => {
      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
        ],
      });
    });

    it("sends email only to FT advisor when present", async () => {
      const ftConnectedBeneficiary: FtConnectUserDto = {
        firstName: "Jean",
        lastName: "Bénéficiaire",
        isJobseeker: true,
        ftExternalId: "beneficiary-external-id",
        email: "jean@beneficiaire.com",
        birthdate: "2000-02-02",
      };
      const ftConnectImmersionAdvisor: FtConnectImmersionAdvisorDto = {
        email: "jean@advisor.com",
        firstName: "Jean",
        lastName: "Advisor",
        type: "PLACEMENT",
      };

      const conventionWithFtConnectUsers: ConventionDto = {
        ...validatedConvention,
        internshipKind: "immersion",
        signatories: {
          ...validatedConvention.signatories,
          beneficiary: {
            ...validatedConvention.signatories.beneficiary,
            ...ftConnectedBeneficiary,
          },
        },
        validators: {
          ...validatedConvention.validators,
          agencyCounsellor: {
            firstname: ftConnectImmersionAdvisor.firstName,
            lastname: ftConnectImmersionAdvisor.lastName,
          },
        },
      };

      uow.conventionRepository.setConventions([conventionWithFtConnectUsers]);
      uow.conventionFranceTravailAdvisorRepository.ftConnectedUsers = {
        [ftConnectedBeneficiary.ftExternalId]: {
          advisor: ftConnectImmersionAdvisor,
          user: ftConnectedBeneficiary,
        },
      };
      uow.conventionFranceTravailAdvisorRepository.conventionFranceTravailUsers =
        {
          [conventionWithFtConnectUsers.id]:
            ftConnectedBeneficiary.ftExternalId,
        };

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
            recipients: [ftConnectImmersionAdvisor.email],
            params: {
              businessName,
              conventionId: conventionWithFtConnectUsers.id,
              beneficiaryFirstName:
                conventionWithFtConnectUsers.signatories.beneficiary.firstName,
              beneficiaryLastName:
                conventionWithFtConnectUsers.signatories.beneficiary.lastName,
              immersionBaseUrl,
            },
          },
        ],
      });
    });

    it("sends email to agency validators when convention is validated and agency has no refersToAgency", async () => {
      uow.conventionRepository.setConventions([validatedConvention]);

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
            recipients: [validator1.email],
            params: {
              businessName,
              conventionId: validatedConvention.id,
              beneficiaryFirstName:
                validatedConvention.signatories.beneficiary.firstName,
              beneficiaryLastName:
                validatedConvention.signatories.beneficiary.lastName,
              immersionBaseUrl,
            },
          },
        ],
      });
    });

    it("sends email to agency validators and agency counsellor when convention is validated and agency has refersToAgency", async () => {
      uow.conventionRepository.setConventions([
        validatedConvention,
        validatedConventionWithRefersToAgency,
      ]);

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
            recipients: [validator1.email],
            params: {
              businessName,
              conventionId: validatedConvention.id,
              beneficiaryFirstName:
                validatedConvention.signatories.beneficiary.firstName,
              beneficiaryLastName:
                validatedConvention.signatories.beneficiary.lastName,
              immersionBaseUrl,
            },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
            recipients: [validator1.email, counsellor1.email],
            params: {
              businessName,
              conventionId: validatedConventionWithRefersToAgency.id,
              beneficiaryFirstName:
                validatedConventionWithRefersToAgency.signatories.beneficiary
                  .firstName,
              beneficiaryLastName:
                validatedConventionWithRefersToAgency.signatories.beneficiary
                  .lastName,
              immersionBaseUrl,
            },
          },
        ],
      });
    });

    it("does not send email to agency validators and agency counsellor when convention has ended", async () => {
      const endedConvention = new ConventionDtoBuilder(
        validatedConventionWithRefersToAgency,
      )
        .withDateEnd(subDays(timeGateway.now(), 1).toISOString())
        .build();

      uow.conventionRepository.setConventions([endedConvention]);

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
        ],
      });
    });

    it("sends all notification types", async () => {
      uow.discussionRepository.discussions = [pendingDiscussion];
      uow.conventionRepository.setConventions([validatedConvention]);

      await notifyThatReferencedEstablishmentIsBanned.execute({ siret });

      expectSavedNotificationsAndEvents({
        emails: [
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [adminUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
            recipients: [contactUser.email],
            params: { businessName, siret },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
            recipients: [pendingDiscussion.potentialBeneficiary.email],
            params: {
              businessName,
              beneficiaryFirstName:
                pendingDiscussion.potentialBeneficiary.firstName,
              beneficiaryLastName:
                pendingDiscussion.potentialBeneficiary.lastName,
              immersionBaseUrl,
            },
          },
          {
            kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
            recipients: [validator1.email],
            params: {
              businessName,
              conventionId: validatedConvention.id,
              beneficiaryFirstName:
                validatedConvention.signatories.beneficiary.firstName,
              beneficiaryLastName:
                validatedConvention.signatories.beneficiary.lastName,
              immersionBaseUrl,
            },
          },
        ],
      });
    });
  });
});
