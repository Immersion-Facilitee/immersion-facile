import {
  type AgencyDto,
  AgencyDtoBuilder,
  type BeneficiaryCurrentEmployer,
  type BeneficiaryRepresentative,
  ConnectedUserBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type Email,
  type EmailParamsByEmailType,
  type EstablishmentRepresentative,
  type EstablishmentTutor,
  type FtConnectIdentity,
  type FtConnectImmersionAdvisorDto,
  type LoginPersona,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
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

describe("NotifyAllActorsOfFinalConventionValidation", () => {
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
            new CustomTimeGateway(),
          ),
          config,
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
    await notifyAllActorsOfFinalConventionValidation.execute({
      convention: validConventionWithSameTutorAndRepresentative,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email:
          validConventionWithSameTutorAndRepresentative.signatories.beneficiary
            .email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },
      {
        email: counsellor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention: validConventionWithSameTutorAndRepresentative,
          agency,
          config,
          loginPersona,
        }),
      })),
    });
  });

  it("With beneficiary current employer", async () => {
    const conventionWithBeneficiaryCurrentEmployer = new ConventionDtoBuilder(
      validConventionWithSameTutorAndRepresentative,
    )
      .withBeneficiaryCurrentEmployer(currentEmployer)
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({
      convention: conventionWithBeneficiaryCurrentEmployer,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email:
          conventionWithBeneficiaryCurrentEmployer.signatories.beneficiary
            .email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },
      {
        email: beneficiaryCurrentEmployerEmail,
        loginPersona: "beneficiary",
      },
      {
        email: counsellor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention: conventionWithBeneficiaryCurrentEmployer,
          agency,
          config,
          loginPersona,
        }),
      })),
    });
  });

  it("With beneficiary representative", async () => {
    const conventionWithBeneficiaryRepresentative = new ConventionDtoBuilder(
      validConventionWithSameTutorAndRepresentative,
    )
      .withBeneficiaryRepresentative(beneficiaryRepresentative)
      .build();

    await notifyAllActorsOfFinalConventionValidation.execute({
      convention: conventionWithBeneficiaryRepresentative,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email:
          conventionWithBeneficiaryRepresentative.signatories.beneficiary.email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },
      {
        email: beneficiaryRepresentativeEmail,
        loginPersona: "beneficiary",
      },
      {
        email: counsellor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention: conventionWithBeneficiaryRepresentative,
          agency,
          config,
          loginPersona,
        }),
      })),
    });
  });

  it("With different establishment tutor and establishment representative", async () => {
    const conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative =
      new ConventionDtoBuilder(validConventionWithSameTutorAndRepresentative)
        .withEstablishmentTutor(establishmentTutor)
        .build();

    await notifyAllActorsOfFinalConventionValidation.execute({
      convention:
        conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email:
          conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative
            .signatories.beneficiary.email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },
      {
        email: establishmentTutorEmail,
        loginPersona: "professional",
      },
      {
        email: counsellor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention:
            conventionWithDifferentEstablishmentTutorAndEstablishmentRepresentative,
          agency,
          config,
          loginPersona,
        }),
      })),
    });
  });

  it("With ftConnect Federated identity: beneficiary, establishment representative, agency counsellor & validator, and dedicated advisor", async () => {
    await notifyAllActorsOfFinalConventionValidation.execute({
      convention: conventionWithFederatedIdentity,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email: conventionWithFederatedIdentity.signatories.beneficiary.email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },

      {
        email: counsellor.email,
        loginPersona: "professional",
      },
      {
        email: ftAdvisor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention: conventionWithFederatedIdentity,
          agency,
          config,
          loginPersona,
        }),
      })),
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

    await notifyAllActorsOfFinalConventionValidation.execute({
      convention: conventionWithFederatedIdentityButNoAdvisor,
    });

    const expectedEmailsAndPersonas: {
      email: Email;
      loginPersona: LoginPersona;
    }[] = [
      {
        email:
          conventionWithFederatedIdentityButNoAdvisor.signatories.beneficiary
            .email,
        loginPersona: "beneficiary",
      },
      {
        email: establishmentRepresentativeEmail,
        loginPersona: "professional",
      },

      {
        email: counsellor.email,
        loginPersona: "professional",
      },
    ];

    expectSavedNotificationsAndEvents({
      emails: expectedEmailsAndPersonas.map(({ email, loginPersona }) => ({
        kind: "VALIDATED_CONVENTION_FINAL_CONFIRMATION",
        recipients: [email],
        params: makeExpectedParams({
          convention: conventionWithFederatedIdentityButNoAdvisor,
          agency,
          config,
          loginPersona,
        }),
      })),
    });
  });

  const makeExpectedParams = ({
    agency,
    config,
    convention,
    loginPersona,
  }: {
    convention: ConventionDto;
    agency: AgencyDto;
    config: AppConfig;
    loginPersona: LoginPersona;
  }): EmailParamsByEmailType["VALIDATED_CONVENTION_FINAL_CONFIRMATION"] => ({
    convention: convention,
    agencyLogoUrl: agency.logoUrl ?? undefined,
    agencyName: agency.name,
    baseUrl: config.immersionFacileBaseUrl,
    loginPersona,
  });
});
