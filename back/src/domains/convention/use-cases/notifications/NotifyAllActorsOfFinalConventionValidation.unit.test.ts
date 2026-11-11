import {
  type AbsoluteUrl,
  AgencyDtoBuilder,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionRole,
  type Email,
  type EmailParamsByEmailType,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  type FtConnectIdentity,
  type FtConnectImmersionAdvisorDto,
  frontRoutes,
  isConventionActorRole,
  loginPersonaByConventionRole,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import { fakeGenerateVisitorOtpUrl } from "../../../../utils/jwtTestHelper";
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
  makeNotifyAllActorsOfFinalConventionValidation,
  type NotifyAllActorsOfFinalConventionValidation,
} from "./NotifyAllActorsOfFinalConventionValidation";

type ExpectedRecipient = {
  email: Email;
  role: ConventionRole;
};

describe("NotifyAllActorsOfFinalConventionValidation", () => {
  const establishmentTutorEmail = "establishment-tutor@mail.com";
  const establishmentRepresentativeEmail =
    "establishment-representativ@gmail.com";
  const beneficiaryCurrentEmployerEmail = "current@employer.com";
  const beneficiaryRepresentativeEmail = "beneficiary@representative.fr";
  const peAdvisorEmail = "ft-advisor@pole-emploi.net";
  const now = new Date("2026-11-11T10:00:00.000Z");
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

  const agency = AgencyDtoBuilder.create(
    validConventionWithSameTutorAndRepresentative.agencyId,
  ).build();

  let uow: InMemoryUnitOfWork;
  let notifyAllActorsOfFinalConventionValidation: NotifyAllActorsOfFinalConventionValidation;
  let config: AppConfig;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    config = new AppConfigBuilder({}).build();
    uow = createInMemoryUow();
    const timeGateway = new CustomTimeGateway(now);
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    notifyAllActorsOfFinalConventionValidation =
      makeNotifyAllActorsOfFinalConventionValidation({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            new UuidV4Generator(),
            timeGateway,
          ),
          config,
          generateVisitorOtpUrl: fakeGenerateVisitorOtpUrl,
          timeGateway,
        },
      });

    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
        [validator.id]: {
          isNotifiedByEmail: true,
          roles: ["validator"],
        },
      }),
    ];
    uow.userRepository.users = [counsellor, validator];
  });

  it("Notify Default actors: beneficiary, establishment representative, agency counsellor, agency validator that convention is validated.", async () => {
    const convention = validConventionWithSameTutorAndRepresentative;

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  it("With beneficiary current employer", async () => {
    const convention = new ConventionDtoBuilder(
      validConventionWithSameTutorAndRepresentative,
    )
      .withBeneficiaryCurrentEmployer(currentEmployer)
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: beneficiaryCurrentEmployerEmail,
        role: "beneficiary-current-employer",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  it("With beneficiary representative", async () => {
    const convention = new ConventionDtoBuilder(
      validConventionWithSameTutorAndRepresentative,
    )
      .withBeneficiaryRepresentative(beneficiaryRepresentative)
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: beneficiaryRepresentativeEmail,
        role: "beneficiary-representative",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  it("With different establishment tutor and establishment representative", async () => {
    const convention = new ConventionDtoBuilder(
      validConventionWithSameTutorAndRepresentative,
    )
      .withEstablishmentTutor(establishmentTutor)
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: establishmentTutorEmail,
        role: "establishment-tutor",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  it("With ftConnect Federated identity: beneficiary, establishment representative, agency counsellor & validator, and dedicated advisor", async () => {
    const convention = conventionWithFederatedIdentity;

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
      {
        email: ftAdvisor.email,
        role: "validator",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  it("With ftConnect Federated identity: beneficiary, establishment tutor, agency counsellor & validator, and no advisor", async () => {
    const convention = new ConventionDtoBuilder(conventionWithFederatedIdentity)
      .withFederatedIdentity({
        provider: "ftConnect",
        token: userFtExternalId,
        payload: {
          advisor: undefined,
        },
      })
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({ convention });

    const expectedRecipients: ExpectedRecipient[] = [
      {
        email: convention.signatories.beneficiary.email,
        role: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        role: "establishment-representative",
      },
      {
        email: counsellor.email,
        role: "counsellor",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: makeExpectedEmails(convention, expectedRecipients),
    });
  });

  const makeExpectedManageConventionLink = ({
    convention,
    role,
    email,
  }: {
    convention: ConventionDto;
    role: ConventionRole;
    email: Email;
  }): AbsoluteUrl =>
    isConventionActorRole(role)
      ? fakeGenerateVisitorOtpUrl({
          conventionId: convention.id,
          role,
          email,
          now,
          targetRoute: "manageConvention",
        })
      : makeRouteAbsoluteUrl({
          route: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.id,
            loginPersona: loginPersonaByConventionRole(role),
            email,
          }),
          baseUrl: config.immersionFacileBaseUrl,
        });

  const makeExpectedEmails = (
    convention: ConventionDto,
    expectedRecipients: ExpectedRecipient[],
  ) =>
    expectedRecipients.map(({ email, role }) => ({
      kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION" as const,
      recipients: [email],
      params: makeExpectedParams({ convention, role, email }),
    }));

  const makeExpectedParams = ({
    convention,
    role,
    email,
  }: {
    convention: ConventionDto;
    role: ConventionRole;
    email: Email;
  }): EmailParamsByEmailType["VALIDATED_CONVENTION_FINAL_CONFIRMATION"] => ({
    convention,
    agencyLogoUrl: agency.logoUrl ?? undefined,
    agencyName: agency.name,
    manageConventionLink: makeExpectedManageConventionLink({
      convention,
      role,
      email,
    }),
  });
});
