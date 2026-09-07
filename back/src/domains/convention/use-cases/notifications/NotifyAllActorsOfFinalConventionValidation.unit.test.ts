import {
  AgencyDtoBuilder,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionRole,
  type EmailNotification,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  expectToEqual,
  type FtConnectIdentity,
  type ShortLinkId,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { fakeGenerateMagicLinkUrlFn } from "../../../../utils/jwtTestHelper";
import type { FtConnectImmersionAdvisorDto } from "../../../core/authentication/ft-connect/dto/FtConnectAdvisor.dto";
import { expectEmailFinalValidationConfirmationParamsMatchingConvention } from "../../../core/notifications/adapters/InMemoryNotificationRepository";
import {
  makeSaveNotificationAndRelatedEvent,
  type WithNotificationIdAndKind,
} from "../../../core/notifications/helpers/Notification";
import { DeterministShortLinkIdGeneratorGateway } from "../../../core/short-link/adapters/short-link-generator-gateway/DeterministShortLinkIdGeneratorGateway";
import type { ShortLink } from "../../../core/short-link/ports/ShortLinkQuery";
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
    conventionShortlinkId: ShortLinkId;
    assessmentCreationLinkId: ShortLinkId | undefined;
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
  let timeGateway: CustomTimeGateway;
  let notifyAllActorsOfFinalConventionValidation: NotifyAllActorsOfFinalConventionValidation;
  let config: AppConfig;
  let shortLinkIdGenerator: DeterministShortLinkIdGeneratorGateway;

  beforeEach(() => {
    config = new AppConfigBuilder({}).build();
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    shortLinkIdGenerator = new DeterministShortLinkIdGeneratorGateway();
    notifyAllActorsOfFinalConventionValidation =
      makeNotifyAllActorsOfFinalConventionValidation({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
          generateConventionMagicLinkUrl: fakeGenerateMagicLinkUrlFn,
          timeGateway,
          shortLinkIdGeneratorGateway: shortLinkIdGenerator,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },

        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
      ];

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: validConventionWithSameTutorAndRepresentative,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          validConventionWithSameTutorAndRepresentative,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },
        {
          role: "beneficiary-current-employer",
          email: beneficiaryCurrentEmployerEmail,
          conventionShortlinkId: "conventionShortlinkId_3",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
      ];

      const conventionWithBeneficiaryCurrentEmployer = new ConventionDtoBuilder(
        validConventionWithSameTutorAndRepresentative,
      )
        .withBeneficiaryCurrentEmployer(currentEmployer)
        .build();

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithBeneficiaryCurrentEmployer,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          validConventionWithSameTutorAndRepresentative,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },
        {
          role: "beneficiary-representative",
          email: beneficiaryRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_2",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
      ];

      const conventionWithBeneficiaryCurrentEmployer = new ConventionDtoBuilder(
        validConventionWithSameTutorAndRepresentative,
      )
        .withBeneficiaryRepresentative(beneficiaryRepresentative)
        .build();

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithBeneficiaryCurrentEmployer,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          validConventionWithSameTutorAndRepresentative,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-tutor",
          email: establishmentTutorEmail,
          conventionShortlinkId: "conventionShortlinkId_2",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },
        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
      ];

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      const conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative =
        new ConventionDtoBuilder(validConventionWithSameTutorAndRepresentative)
          .withEstablishmentTutor(establishmentTutor)
          .build();

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention:
          conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },
        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "validator",
          email: peAdvisorEmail,
          conventionShortlinkId: "conventionShortlinkId_2",
          assessmentCreationLinkId: undefined,
        },
      ];

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      uow.conventionRepository.setConventions([
        conventionWithFederatedIdentity,
      ]);

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithFederatedIdentity,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          validConventionWithSameTutorAndRepresentative,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
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
          conventionShortlinkId: "conventionShortlinkId_0",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "establishment-representative",
          email: establishmentRepresentativeEmail,
          conventionShortlinkId: "conventionShortlinkId_1",
          assessmentCreationLinkId: "assessmentCreationLinkId_1",
        },
        {
          role: "validator",
          email: validator.email,
          conventionShortlinkId: "conventionShortlinkId_5",
          assessmentCreationLinkId: undefined,
        },
        {
          role: "counsellor",
          email: counsellor.email,
          conventionShortlinkId: "conventionShortlinkId_6",
          assessmentCreationLinkId: undefined,
        },
      ];

      const actorsWithShortlinks = actors.filter(
        (actor) => actor.role !== "validator" && actor.role !== "counsellor",
      );
      const shortlinkIds = actorsWithShortlinks.flatMap((actor) => {
        return actor.assessmentCreationLinkId
          ? [actor.conventionShortlinkId, actor.assessmentCreationLinkId]
          : [actor.conventionShortlinkId];
      });

      shortLinkIdGenerator.addMoreShortLinkIds(shortlinkIds);

      uow.conventionRepository.setConventions([
        conventionWithFederatedIdentityButNoAdvisor,
      ]);

      await notifyAllActorsOfFinalConventionValidation.execute({
        convention: conventionWithFederatedIdentityButNoAdvisor,
      });

      expectToEqual(
        uow.shortLinkQuery.getShortLinks(),
        makeExpectedShortLinks(
          actorsWithShortlinks,
          conventionWithFederatedIdentityButNoAdvisor,
          timeGateway,
        ),
      );

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
          actor.conventionShortlinkId,
          actor.assessmentCreationLinkId,
          actor.role,
        );
      });
    });
  });
});

const makeExpectedShortLinks = (
  actorsWithShortlinks: {
    role: ConventionRole;
    email: string;
    conventionShortlinkId: ShortLinkId;
    assessmentCreationLinkId: ShortLinkId | undefined;
  }[],
  convention: ConventionDto,
  timeGateway: CustomTimeGateway,
): ShortLink[] =>
  actorsWithShortlinks.reduce<ShortLink[]>(
    (shortLinks, actor) => [
      ...shortLinks,
      {
        id: actor.conventionShortlinkId,
        url: fakeGenerateMagicLinkUrlFn({
          id: convention.id,
          role: actor.role,
          email: actor.email,
          now: timeGateway.now(),
          expOverride: timeGateway.now().getTime() + 1000 * 60 * 60 * 24 * 365,
          targetRoute: "conventionDocument",
          lifetime: "1Month",
        }),
        lastUsedAt: null,
      },
      ...(actor.assessmentCreationLinkId
        ? [
            {
              id: actor.assessmentCreationLinkId,
              url: fakeGenerateMagicLinkUrlFn({
                id: convention.id,
                role: actor.role,
                email: actor.email,
                now: timeGateway.now(),
                expOverride:
                  timeGateway.now().getTime() + 1000 * 60 * 60 * 24 * 365,
                targetRoute: "assessment",
                lifetime: "2Days",
              }),
              lastUsedAt: null,
            },
          ]
        : []),
    ],
    [],
  );
