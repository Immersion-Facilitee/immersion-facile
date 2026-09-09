import {
  AgencyDtoBuilder,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  type ConventionRole,
  type EmailNotification,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  type FtConnectIdentity,
  type FtConnectImmersionAdvisorDto,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { expectEmailFinalValidationConfirmationParamsMatchingConvention } from "../../../core/notifications/adapters/InMemoryNotificationRepository";
import {
  makeSaveNotificationAndRelatedEvent,
  type WithNotificationIdAndKind,
} from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyAllActorsOfFinalConventionValidation,
  type NotifyAllActorsOfFinalConventionValidation,
} from "./NotifyAllActorsOfFinalConventionValidation";

describe("NotifyAllActorsOfFinalConventionValidation", () => {
  type ActorForNotification = {
    role: ConventionRole;
    email: string;
  };
  const establishmentTutorEmail = "establishment-tutor@mail.com";
  const establishmentRepresentativeEmail =
    "establishment-representativ@gmail.com";
  const beneficiaryCurrentEmployerEmail = "current@employer.com";
  const beneficiaryRepresentativeEmail = "beneficiary@representative.fr";
  const peAdvisorEmail = "ft-advisor@pole-emploi.net";
  const counsellor = new ConnectedUserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@email.fr")
    .build();
  const validator = new ConnectedUserBuilder()
    .withId("myValidator")
    .withEmail("myValidator@mail.com")
    .build();

  const establishmentRepresentative: EstablishmentRepresentative = {
    role: "establishment-representative",
    email: establishmentRepresentativeEmail,
    phone: "+33665565432",
    firstName: "Joe",
    lastName: "le directeur",
  };

  const establishmentTutor: EstablishmentTutor = {
    role: "establishment-tutor",
    email: establishmentTutorEmail,
    phone: "+33665565434",
    firstName: "Jean",
    lastName: "le tuteur",
    job: "Directeur",
  };

  const beneficiaryRepresentative: BeneficiaryRepresentative = {
    role: "beneficiary-representative",
    email: beneficiaryRepresentativeEmail,
    phone: "+33665565432",
    firstName: "Bob",
    lastName: "L'éponge",
  };
  const currentEmployer: BeneficiaryCurrentEmployer = {
    businessName: "boss",
    role: "beneficiary-current-employer",
    email: beneficiaryCurrentEmployerEmail,
    phone: "+33611223344",
    firstName: "Harry",
    lastName: "Potter",
    job: "Magician",
    businessSiret: "01234567891234",
    businessAddress: "Rue des Bouchers 67065 Strasbourg",
  };

  const validConventionWithSameTutorAndRepresentative =
    new ConventionDtoBuilder()
      .withEstablishmentRepresentative(establishmentRepresentative)
      .withEstablishmentTutor({
        ...establishmentRepresentative,
        role: "establishment-tutor",
        job: "tuteur",
      })
      .build();

  const userFtExternalId = "92f44bbf-103d-4312-bd74-217c7d79f618";

  const ftAdvisor: FtConnectImmersionAdvisorDto = {
    firstName: "Jean",
    lastName: "Dupont",
    email: peAdvisorEmail,
    type: "PLACEMENT",
  };
  const federatedIdentity: FtConnectIdentity = {
    provider: "ftConnect",
    token: userFtExternalId,
    payload: {
      advisor: ftAdvisor,
    },
  };
  const conventionWithFederatedIdentity = new ConventionDtoBuilder(
    validConventionWithSameTutorAndRepresentative,
  )
    .withFederatedIdentity(federatedIdentity)
    .build();

  const defaultAgency = AgencyDtoBuilder.create(
    validConventionWithSameTutorAndRepresentative.agencyId,
  ).build();

  let uow: InMemoryUnitOfWork;
  let notifyAllActorsOfFinalConventionValidation: NotifyAllActorsOfFinalConventionValidation;
  let config: AppConfig;

  beforeEach(() => {
    config = new AppConfigBuilder({}).build();
    uow = createInMemoryUow();
    const timeGateway = new CustomTimeGateway();
    notifyAllActorsOfFinalConventionValidation =
      makeNotifyAllActorsOfFinalConventionValidation({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
          config,
        },
      });

    uow.agencyRepository.agencies = [
      toAgencyWithRights(defaultAgency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: {
          isNotifiedByEmail: true,
          roles: ["validator", "counsellor"],
        },
      }),
    ];
    uow.userRepository.users = [counsellor, validator];
  });

  describe("NotifyAllActorsOfFinalApplicationValidation sends confirmation email to all actors", () => {
    it("Notify Default actors: beneficiary, establishment representative, agency counsellor, agency validator that convention is validated.", async () => {
      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
      ];

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: validConventionWithSameTutorAndRepresentative,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(4);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          validConventionWithSameTutorAndRepresentative,
          config,
          actor.role,
        );
      });
    });

    it("With beneficiary current employer", async () => {
      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "beneficiary-current-employer",
          email: beneficiaryCurrentEmployerEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
      ];

      const conventionWithBeneficiaryCurrentEmployer = new ConventionDtoBuilder(
        validConventionWithSameTutorAndRepresentative,
      )
        .withBeneficiaryCurrentEmployer(currentEmployer)
        .build();

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithBeneficiaryCurrentEmployer,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(5);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          conventionWithBeneficiaryCurrentEmployer,
          config,
          actor.role,
        );
      });
    });

    it("With beneficiary representative", async () => {
      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "beneficiary-representative",
          email: beneficiaryRepresentativeEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
      ];

      const conventionWithBeneficiaryRepresentative = new ConventionDtoBuilder(
        validConventionWithSameTutorAndRepresentative,
      )
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithBeneficiaryRepresentative,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(5);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          conventionWithBeneficiaryRepresentative,
          config,
          actor.role,
        );
      });
    });

    it("With different establishment tutor and establishment representative", async () => {
      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "establishment-tutor",
          email: establishmentTutorEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
      ];

      const conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative =
        new ConventionDtoBuilder(validConventionWithSameTutorAndRepresentative)
          .withEstablishmentTutor(establishmentTutor)
          .build();

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention:
          conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(5);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
          config,
          actor.role,
        );
      });
    });

    it("With ftConnect Federated identity: beneficiary, establishment representative, agency counsellor & validator, and dedicated advisor", async () => {
      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
        {
          role: "validator",
          email: peAdvisorEmail,
        },
      ];

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithFederatedIdentity,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(5);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          validConventionWithSameTutorAndRepresentative,
          config,
          actor.role,
        );
      });
    });

    it("With ftConnect Federated identity: beneficiary, establishment tutor, agency counsellor & validator, and no advisor", async () => {
      const conventionWithFederatedIdentityButNoAdvisor =
        new ConventionDtoBuilder(conventionWithFederatedIdentity)
          .withFederatedIdentity({
            provider: "ftConnect",
            token: userFtExternalId,
            payload: {
              advisor: undefined,
            },
          })
          .build();

      const actors: ActorForNotification[] = [
        {
          role: "beneficiary",
          email:
            validConventionWithSameTutorAndRepresentative.signatories
              .beneficiary.email,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
        },
        {
          role: "validator",
          email: validator.email,
        },
        {
          role: "counsellor",
          email: counsellor.email,
        },
      ];

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithFederatedIdentityButNoAdvisor,
      });

      const emailNotifications =
        uow.notificationRepository.notifications.filter(
          (notification): notification is EmailNotification =>
            notification.kind === "email",
        );

      expect(uow.outboxRepository.events.map(({ payload }) => payload)).toEqual(
        emailNotifications.map(
          ({ id }): WithNotificationIdAndKind => ({ id, kind: "email" }),
        ),
      );
      expect(emailNotifications).toHaveLength(4);

      actors.forEach((actor, index) => {
        expectEmailFinalValidationConfirmationParamsMatchingConvention(
          [actor.email],
          emailNotifications[index].templatedContent,
          defaultAgency,
          conventionWithFederatedIdentityButNoAdvisor,
          config,
          actor.role,
        );
      });
    });
  });
});
