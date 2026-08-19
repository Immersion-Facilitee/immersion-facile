import {
  type AgencyDto,
  AgencyDtoBuilder,
  type AgencyKind,
  type AssessmentDto,
  AssessmentDtoBuilder,
  type ConventionDto,
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionReadDto,
  expectObjectsToMatch,
  expectToEqual,
  type FeatureFlags,
  makeEmptyLastReminders,
  reasonableSchedule,
  UserBuilder,
} from "shared";
import {
  toAgencyWithRights,
  toPartnerAgencyKind,
} from "../../../../utils/agency";
import { broadcastToFtServiceName } from "../../../core/saved-errors/ports/BroadcastFeedbacksRepository";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryFranceTravailGateway } from "../../adapters/france-travail-gateway/InMemoryFranceTravailGateway";
import {
  type BroadcastToFranceTravailOnConventionUpdates,
  makeBroadcastToFranceTravailOnConventionUpdates,
} from "./BroadcastToFranceTravailOnConventionUpdates";

describe("BroadcastToFranceTravailOnConventionUpdates", () => {
  const peAgencyWithoutCounsellorsAndValidators = new AgencyDtoBuilder()
    .withId("some-pe-agency")
    .withKind("france-travail")
    .build();

  const agencySIAE = toAgencyWithRights(
    new AgencyDtoBuilder(peAgencyWithoutCounsellorsAndValidators)
      .withId("agency-SIAE-id")
      .withKind("structure-IAE")
      .build(),
  );

  const conventionLinkedToSIAE = new ConventionDtoBuilder()
    .withId("11110000-0000-4000-9000-000000000001")
    .withAgencyId(agencySIAE.id)
    .build();

  const conventionLinkedToFTWithoutFederatedIdentity =
    new ConventionDtoBuilder()
      .withId("00000000-0000-4000-9000-000000000000")
      .withAgencyId(peAgencyWithoutCounsellorsAndValidators.id)
      .withoutFederatedIdentity()
      .build();

  const counsellor = new UserBuilder()
    .withId("counsellor")
    .withEmail("counsellor@mail.com")
    .build();

  const validator = new UserBuilder()
    .withId("validator")
    .withEmail("validator@mail.com")
    .build();

  let franceTravailGateway: InMemoryFranceTravailGateway;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let broadcastToFranceTravailOnConventionUpdates: BroadcastToFranceTravailOnConventionUpdates;

  beforeEach(() => {
    uow = createInMemoryUow();
    franceTravailGateway = new InMemoryFranceTravailGateway();
    timeGateway = new CustomTimeGateway();
    broadcastToFranceTravailOnConventionUpdates =
      makeBroadcastToFranceTravailOnConventionUpdates({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          franceTravailGateway,
          timeGateway,
          options: { resyncMode: false },
        },
      });

    uow.userRepository.users = [counsellor, validator];

    uow.agencyRepository.agencies = [
      toAgencyWithRights(peAgencyWithoutCounsellorsAndValidators, {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
        [counsellor.id]: { isNotifiedByEmail: true, roles: ["counsellor"] },
      }),
    ];
  });

  it("Skips convention if not linked to an agency of kind france-travail nor agencyRefersTo of kind france-travail", async () => {
    uow.agencyRepository.agencies = [agencySIAE];

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionReadDtoFrom({
        convention: conventionLinkedToSIAE,
        agency: {
          ...agencySIAE,
          validatorEmails: [],
          counsellorEmails: [],
        },
      }),
    });

    expectToEqual(franceTravailGateway.broadcastParamsCalls, []);
  });

  it("broadcasts france travail agencyKind as pole-emploi", async () => {
    const convention = conventionReadDtoFrom({
      convention: conventionLinkedToFTWithoutFederatedIdentity,
      agency: {
        ...peAgencyWithoutCounsellorsAndValidators,
        counsellorEmails: [counsellor.email],
        validatorEmails: [validator.email],
      },
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention,
    });

    expectToEqual(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(convention),
          agencyKind: "pole-emploi",
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("broadcasts france travail agencyRefersTo.kind as pole-emploi", async () => {
    const agencyWithRefersTo = toAgencyWithRights(
      new AgencyDtoBuilder(peAgencyWithoutCounsellorsAndValidators)
        .withId("agency-with-refers-to-for-outbound-kind")
        .withKind("autre")
        .withRefersToAgencyInfo({
          refersToAgencyId: peAgencyWithoutCounsellorsAndValidators.id,
          refersToAgencyName: peAgencyWithoutCounsellorsAndValidators.name,
          refersToAgencyContactEmail:
            peAgencyWithoutCounsellorsAndValidators.contactEmail,
        })
        .build(),
    );

    uow.agencyRepository.agencies = [
      toAgencyWithRights(peAgencyWithoutCounsellorsAndValidators),
      agencyWithRefersTo,
    ];

    const conventionLinkedToAgencyReferingToFt = new ConventionDtoBuilder()
      .withId("55555555-5555-4000-9555-555555555555")
      .withAgencyId(agencyWithRefersTo.id)
      .build();

    const convention = conventionReadDtoFrom({
      convention: conventionLinkedToAgencyReferingToFt,
      agency: {
        ...agencyWithRefersTo,
        validatorEmails: [],
        counsellorEmails: [],
      },
      referredAgency: peAgencyWithoutCounsellorsAndValidators,
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention,
    });

    expectToEqual(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(convention),
          agencyKind: "autre",
          agencyRefersTo: {
            id: peAgencyWithoutCounsellorsAndValidators.id,
            name: peAgencyWithoutCounsellorsAndValidators.name,
            contactEmail: peAgencyWithoutCounsellorsAndValidators.contactEmail,
            kind: "pole-emploi",
            siret: peAgencyWithoutCounsellorsAndValidators.agencySiret,
          },
          agencyValidatorEmails: [],
        },
      },
    ]);
  });

  it("Conventions without federated id are still sent, with their externalId", async () => {
    const externalId = "00000000001";
    uow.conventionExternalIdRepository.externalIdsByConventionId = {
      [conventionLinkedToFTWithoutFederatedIdentity.id]: externalId,
    };

    const convention = conventionReadDtoFrom({
      convention: conventionLinkedToFTWithoutFederatedIdentity,
      agency: {
        ...peAgencyWithoutCounsellorsAndValidators,
        counsellorEmails: [counsellor.email],
        validatorEmails: [validator.email],
      },
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention,
    });

    // Assert

    expectObjectsToMatch(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(convention),
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("save the convention id with status TO_PROCESS in the conventionsToSyncWithPe repository when FT broadcast times out", async () => {
    franceTravailGateway.setNextResponse({
      status: 500,
      subscriberErrorFeedback: {
        message: "timeout of 30000ms exceeded",
        error: new Error("timeout of 30000ms exceeded"),
      },
      body: undefined,
    });
    const now = new Date();
    timeGateway.setNextDate(now);

    const conventionRead = conventionReadDtoFrom({
      convention: conventionLinkedToFTWithoutFederatedIdentity,
      agency: {
        ...peAgencyWithoutCounsellorsAndValidators,
        counsellorEmails: [counsellor.email],
        validatorEmails: [validator.email],
      },
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionRead,
    });

    expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
      {
        id: conventionLinkedToFTWithoutFederatedIdentity.id,
        status: "TO_PROCESS",
      },
    ]);

    expectObjectsToMatch(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(conventionRead),
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("when FT broadcast times out again for a convention already queued, updates the row to TO_PROCESS", async () => {
    uow.conventionsToSyncRepository.setForTesting([
      {
        id: conventionLinkedToFTWithoutFederatedIdentity.id,
        status: "SUCCESS",
        processDate: new Date("2020-01-01"),
      },
    ]);
    franceTravailGateway.setNextResponse({
      status: 500,
      subscriberErrorFeedback: {
        message: "timeout of 30000ms exceeded",
        error: new Error("timeout of 30000ms exceeded"),
      },
      body: undefined,
    });
    timeGateway.setNextDate(new Date());

    const conventionRead = conventionReadDtoFrom({
      convention: conventionLinkedToFTWithoutFederatedIdentity,
      agency: {
        ...peAgencyWithoutCounsellorsAndValidators,
        counsellorEmails: [counsellor.email],
        validatorEmails: [validator.email],
      },
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionRead,
    });

    expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
      {
        id: conventionLinkedToFTWithoutFederatedIdentity.id,
        status: "TO_PROCESS",
      },
    ]);

    expectObjectsToMatch(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(conventionRead),
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("If Pe returns a 404 error, we store the error in a repo", async () => {
    franceTravailGateway.setNextResponse({
      status: 404,
      subscriberErrorFeedback: { message: "Ops, something is bad" },
      body: "not found",
    });
    const now = new Date();
    timeGateway.setNextDate(now);

    // Act
    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionReadDtoFrom({
        convention: conventionLinkedToFTWithoutFederatedIdentity,
        agency: {
          ...peAgencyWithoutCounsellorsAndValidators,
          counsellorEmails: [counsellor.email],
          validatorEmails: [validator.email],
        },
      }),
    });

    // Assert
    expectToEqual(uow.broadcastFeedbacksRepository.broadcastFeedbacks, [
      {
        consumerId: null,
        consumerName: "France Travail",
        conventionId: conventionLinkedToFTWithoutFederatedIdentity.id,
        agencyId: conventionLinkedToFTWithoutFederatedIdentity.agencyId,
        serviceName: broadcastToFtServiceName,
        requestParams: {
          conventionId: conventionLinkedToFTWithoutFederatedIdentity.id,
          conventionStatus: conventionLinkedToFTWithoutFederatedIdentity.status,
        },
        response: { httpStatus: 404, body: "not found" },
        subscriberErrorFeedback: {
          message: "Ops, something is bad",
        },
        occurredAt: now.toISOString(),
        handledByAgency: false,
      },
    ]);
  });

  it("store the broadcast feetback success in a repo", async () => {
    franceTravailGateway.setNextResponse({
      status: 200,
      body: { success: true },
    });
    const now = new Date();
    timeGateway.setNextDate(now);

    // Act
    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionReadDtoFrom({
        convention: conventionLinkedToFTWithoutFederatedIdentity,
        agency: {
          ...peAgencyWithoutCounsellorsAndValidators,
          counsellorEmails: [counsellor.email],
          validatorEmails: [validator.email],
        },
      }),
    });

    // Assert
    expectToEqual(uow.broadcastFeedbacksRepository.broadcastFeedbacks, [
      {
        consumerId: null,
        consumerName: "France Travail",
        conventionId: conventionLinkedToFTWithoutFederatedIdentity.id,
        agencyId: conventionLinkedToFTWithoutFederatedIdentity.agencyId,
        serviceName: broadcastToFtServiceName,
        requestParams: {
          conventionId: conventionLinkedToFTWithoutFederatedIdentity.id,
          conventionStatus: conventionLinkedToFTWithoutFederatedIdentity.status,
        },
        response: {
          httpStatus: 200,
          body: {
            success: true,
          },
        },
        occurredAt: now.toISOString(),
        handledByAgency: false,
      },
    ]);
  });

  it("Converts and sends conventions, with externalId and federated id", async () => {
    // Prepare
    const immersionConventionId: ConventionId =
      "00000000-0000-0000-0000-000000000000";

    const externalId = "00000000001";
    uow.conventionExternalIdRepository.externalIdsByConventionId = {
      [immersionConventionId]: externalId,
    };

    const convention = new ConventionDtoBuilder()
      .withId(immersionConventionId)
      .withAgencyId(peAgencyWithoutCounsellorsAndValidators.id)
      .withImmersionAppellation({
        appellationCode: "11111",
        appellationLabel: "some Appellation",
        romeCode: "A1111",
        romeLabel: "some Rome",
      })
      .withBeneficiaryBirthdate("2000-10-05")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withFederatedIdentity({ provider: "ftConnect", token: "some-id" })
      .withDateStart("2021-05-12")
      .withDateEnd("2021-05-14T00:30:00.000Z")
      .withSchedule(reasonableSchedule)
      .withImmersionObjective("Initier une démarche de recrutement")
      .build();

    const conventionRead = conventionReadDtoFrom({
      convention: convention,
      agency: {
        ...peAgencyWithoutCounsellorsAndValidators,
        counsellorEmails: [counsellor.email],
        validatorEmails: [validator.email],
      },
    });
    // Act
    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionRead,
    });

    // Assert
    expectToEqual(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(conventionRead),
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("Converts and sends conventions, with limit 255 bytes on sanitaryPreventionDescription, individualProtectionDescription & tutor job", async () => {
    const convention = new ConventionDtoBuilder()
      .withAgencyId(peAgencyWithoutCounsellorsAndValidators.id)
      .withSanitaryPreventionDescription(
        "•	Lavage régulier des mains 	•	Port d’une tenue propre (blouse, tablier) 	•	Port du filet à cheveux ou charlotte 	•	Nettoyage fréquent du plan de travail et du matériel 	•	Respect des règles d’hygiène liées à la manipulation des produits alimentaires",
      )
      .withIndividualProtectionDescription(
        "Gants à usage unique  Masques (chirurgicaux ou FFP2 selon les situations)  Tenue professionnelle (pantalon, polo ou blouson aux normes)  Chaussures de sécurité ou adaptées au transport sanitaire  Gilet fluorescent pour interventions sur voie publique",
      )
      .withEstablishmentTutorJob(
        "Responsable des affaires juridiques et institutionnelles au sein du Service des Affaires juridiques et institutionnelles ; Délégué à la protection des données personnelles (DPO) ; Responsable de l’accès aux documents administratifs (PRADA)",
      )
      .build();

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionReadDtoFrom({
        convention,
        agency: {
          ...peAgencyWithoutCounsellorsAndValidators,
          counsellorEmails: [counsellor.email],
          validatorEmails: [validator.email],
        },
      }),
    });

    expectToEqual(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(
            conventionReadDtoFrom({
              convention: {
                ...convention,
                sanitaryPreventionDescription:
                  "•	Lavage regulier des mains 	•	Port d'une tenue propre (blouse, tablier) 	•	Port du filet a cheveux ou charlotte 	•	Nettoyage frequent du plan de travail et du materiel 	•	Respect des regles d'hygiene liees a la manipulation des produits aliment",
                individualProtectionDescription:
                  "Gants a usage unique  Masques (chirurgicaux ou FFP2 selon les situations)  Tenue professionnelle (pantalon, polo ou blouson aux normes)  Chaussures de securite ou adaptees au transport sanitaire  Gilet fluorescent pour interventions sur voie publique",
                establishmentTutor: {
                  ...convention.establishmentTutor,
                  job: "Responsable des affaires juridiques et institutionnelles au sein du Service des Affaires juridiques et institutionnelles ; Délégué à la protection des données personnelles (DPO) ; Responsable de l’accès aux documents administratifs (PRADA)",
                },
              },
              agency: {
                ...peAgencyWithoutCounsellorsAndValidators,
                counsellorEmails: [counsellor.email],
                validatorEmails: [validator.email],
              },
            }),
          ),
          agencyValidatorEmails: [validator.email],
        },
      },
    ]);
  });

  it("broadcast to pole-emploi when convention is from an agency RefersTo", async () => {
    // Prepare
    const agencyWithRefersTo = toAgencyWithRights(
      new AgencyDtoBuilder(peAgencyWithoutCounsellorsAndValidators)
        .withId("635354435345435")
        .withKind("autre")
        .withRefersToAgencyInfo({
          refersToAgencyId: peAgencyWithoutCounsellorsAndValidators.id,
          refersToAgencyName: peAgencyWithoutCounsellorsAndValidators.name,
          refersToAgencyContactEmail:
            peAgencyWithoutCounsellorsAndValidators.contactEmail,
        })
        .build(),
    );

    const conventionLinkedToAgencyReferingToOther = new ConventionDtoBuilder()
      .withId("22222222-2222-4000-9222-222222222222")
      .withAgencyId(agencyWithRefersTo.id)
      .withImmersionAppellation({
        appellationCode: "11111",
        appellationLabel: "some Appellation",
        romeCode: "A1111",
        romeLabel: "some Rome",
      })
      .withBeneficiaryBirthdate("2000-10-05")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withDateStart("2021-05-12")
      .withDateEnd("2021-05-14T00:30:00.000Z") //
      .withSchedule(reasonableSchedule)
      .withImmersionObjective("Initier une démarche de recrutement")
      .build();

    uow.agencyRepository.agencies = [
      toAgencyWithRights(peAgencyWithoutCounsellorsAndValidators),
      agencyWithRefersTo,
    ];

    const externalId = "00000000001";
    const assessment = new AssessmentDtoBuilder()
      .withConventionId(conventionLinkedToAgencyReferingToOther.id)
      .build();
    uow.conventionExternalIdRepository.externalIdsByConventionId = {
      [conventionLinkedToAgencyReferingToOther.id]: externalId,
    };

    const conventionRead = conventionReadDtoFrom({
      convention: conventionLinkedToAgencyReferingToOther,
      agency: {
        ...agencyWithRefersTo,
        validatorEmails: [],
        counsellorEmails: [],
      },
      referredAgency: peAgencyWithoutCounsellorsAndValidators,
      assessment: assessment,
    });

    await broadcastToFranceTravailOnConventionUpdates.execute({
      eventType: "CONVENTION_UPDATED",
      convention: conventionRead,
    });

    // Assert
    expectToEqual(franceTravailGateway.broadcastParamsCalls, [
      {
        eventType: "CONVENTION_UPDATED",
        convention: {
          ...toExpectedFtConvention(conventionRead),
          agencyValidatorEmails: [],
        },
      },
    ]);
  });

  describe("sends also other type of Convention when corresponding feature flag is activated", () => {
    const createAgencyAndLinkedConvention = (kind: AgencyKind) => {
      const agency = toAgencyWithRights(
        new AgencyDtoBuilder().withId(kind).withKind(kind).build(),
      );

      return {
        agency,
        convention: new ConventionDtoBuilder()
          .withId("33333333-3333-4000-9333-333333333333")
          .withAgencyId(agency.id)
          .build(),
      };
    };

    describe.each([
      {
        agencyKind: "mission-locale" as AgencyKind,
        featureFlag: {
          enableBroadcastOfMissionLocaleToFT: {
            kind: "boolean",
            isActive: true,
          },
        } as Partial<FeatureFlags>,
        ...createAgencyAndLinkedConvention("mission-locale"),
      },
      {
        agencyKind: "conseil-departemental" as AgencyKind,
        featureFlag: {
          enableBroadcastOfConseilDepartementalToFT: {
            kind: "boolean",
            isActive: true,
          },
        } as Partial<FeatureFlags>,
        ...createAgencyAndLinkedConvention("conseil-departemental"),
      },
      {
        agencyKind: "cap-emploi" as AgencyKind,
        featureFlag: {
          enableBroadcastOfCapEmploiToFT: {
            kind: "boolean",
            isActive: true,
          },
        } as Partial<FeatureFlags>,
        ...createAgencyAndLinkedConvention("cap-emploi"),
      },
    ])("when enable $agencyKind feature flag is ACTIVE", ({
      agencyKind,
      featureFlag,
      agency,
      convention,
    }) => {
      it(`broadcasts to france travail, even for convention linked to ${agencyKind}`, async () => {
        uow.agencyRepository.agencies = [agency];
        uow.featureFlagRepository.featureFlags = {
          enableBroadcastOfMissionLocaleToFT: {
            kind: "boolean",
            isActive: false,
          },
          enableBroadcastOfCapEmploiToFT: {
            kind: "boolean",
            isActive: false,
          },
          enableBroadcastOfConseilDepartementalToFT: {
            kind: "boolean",
            isActive: false,
          },
          ...featureFlag,
        };
        const conventionRead = conventionReadDtoFrom({
          convention,
          agency: {
            ...agency,
            validatorEmails: [],
            counsellorEmails: [],
          },
        });

        await broadcastToFranceTravailOnConventionUpdates.execute({
          eventType: "CONVENTION_UPDATED",
          convention: conventionRead,
        });

        expectToEqual(franceTravailGateway.broadcastParamsCalls, [
          {
            eventType: "CONVENTION_UPDATED",
            convention: {
              ...toExpectedFtConvention(conventionRead),
              agencyValidatorEmails: [],
            },
          },
        ]);
      });

      it(`do not broadcast to france travail when convention is from an agency RefersTo (and the refered agency is ${agencyKind})`, async () => {
        uow.featureFlagRepository.featureFlags = featureFlag;

        const agencyWithRefersTo = toAgencyWithRights(
          new AgencyDtoBuilder(peAgencyWithoutCounsellorsAndValidators)
            .withId("agency-with-refers-to-id")
            .withKind("autre")
            .withRefersToAgencyInfo({
              refersToAgencyId: agency.id,
              refersToAgencyName: agency.name,
              refersToAgencyContactEmail: agency.contactEmail,
            })
            .build(),
        );

        const conventionLinkedToAgencyReferingToOther =
          new ConventionDtoBuilder()
            .withId("22222222-2222-4000-9222-222222222222")
            .withAgencyId(agencyWithRefersTo.id)
            .withStatus("ACCEPTED_BY_VALIDATOR")
            .build();

        uow.agencyRepository.agencies = [agency, agencyWithRefersTo];

        const externalId = "00000000001";
        uow.conventionExternalIdRepository.externalIdsByConventionId = {
          [conventionLinkedToAgencyReferingToOther.id]: externalId,
        };

        await broadcastToFranceTravailOnConventionUpdates.execute({
          eventType: "CONVENTION_UPDATED",
          convention: conventionReadDtoFrom({
            convention: conventionLinkedToAgencyReferingToOther,
            agency: {
              ...agencyWithRefersTo,
              validatorEmails: [],
              counsellorEmails: [],
            },
            referredAgency: {
              ...agency,
              validatorEmails: [],
              counsellorEmails: [],
            },
          }),
        });

        // Assert
        expectToEqual(franceTravailGateway.broadcastParamsCalls, []);
      });
    });

    describe.each([
      {
        agencyKind: "mission-locale" as AgencyKind,
        ...createAgencyAndLinkedConvention("mission-locale"),
      },
      {
        agencyKind: "conseil-departemental" as AgencyKind,
        ...createAgencyAndLinkedConvention("conseil-departemental"),
      },
      {
        agencyKind: "cap-emploi" as AgencyKind,
        ...createAgencyAndLinkedConvention("cap-emploi"),
      },
    ])("when $agencyKind feature flag is OFF", ({
      agencyKind,
      agency,
      convention,
    }) => {
      it(`does NOT broadcasts to france travail, for ${agencyKind}`, async () => {
        uow.agencyRepository.agencies = [agency];
        uow.featureFlagRepository.featureFlags = {
          enableBroadcastOfMissionLocaleToFT: {
            kind: "boolean",
            isActive: false,
          },
          enableBroadcastOfCapEmploiToFT: {
            kind: "boolean",
            isActive: false,
          },
          enableBroadcastOfConseilDepartementalToFT: {
            kind: "boolean",
            isActive: false,
          },
        };

        await broadcastToFranceTravailOnConventionUpdates.execute({
          eventType: "CONVENTION_UPDATED",
          convention: conventionReadDtoFrom({
            convention,
            agency: {
              ...agency,
              validatorEmails: [],
              counsellorEmails: [],
            },
          }),
        });

        expectToEqual(franceTravailGateway.broadcastParamsCalls, []);
      });
    });
  });

  describe("when previousAgencyId is provided", () => {
    const peAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("pe-agency-for-transfer")
        .withKind("france-travail")
        .build(),
    );

    const siaeAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("siae-agency-for-transfer")
        .withKind("structure-IAE")
        .build(),
    );

    const autreAgency = toAgencyWithRights(
      new AgencyDtoBuilder()
        .withId("autre-agency-for-transfer")
        .withKind("autre")
        .build(),
    );

    const conventionOnSiaeAgency = new ConventionDtoBuilder()
      .withId("44440000-0000-4000-9000-000000000001")
      .withAgencyId(siaeAgency.id)
      .build();

    it("broadcasts when current agency does not qualify but previous agency does", async () => {
      uow.agencyRepository.agencies = [siaeAgency, peAgency];

      const conventionRead = conventionReadDtoFrom({
        convention: conventionOnSiaeAgency,
        agency: {
          ...siaeAgency,
          validatorEmails: [],
          counsellorEmails: [],
        },
      });

      await broadcastToFranceTravailOnConventionUpdates.execute({
        eventType: "CONVENTION_UPDATED",
        convention: conventionRead,
        previousAgencyId: peAgency.id,
      });

      expectToEqual(franceTravailGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...toExpectedFtConvention(conventionRead),
            agencyValidatorEmails: [],
          },
          previousAgencyId: peAgency.id,
        },
      ]);
    });

    it("broadcasts only once when both current and previous agencies qualify", async () => {
      const conventionOnPeAgency = new ConventionDtoBuilder()
        .withId("44440000-0000-4000-9000-000000000002")
        .withAgencyId(peAgency.id)
        .build();
      const anotherPeAgency = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId("another-pe-agency")
          .withKind("france-travail")
          .build(),
      );
      uow.agencyRepository.agencies = [peAgency, anotherPeAgency];

      const conventionRead = conventionReadDtoFrom({
        convention: conventionOnPeAgency,
        agency: {
          ...peAgency,
          validatorEmails: [],
          counsellorEmails: [],
        },
      });

      await broadcastToFranceTravailOnConventionUpdates.execute({
        eventType: "CONVENTION_UPDATED",
        convention: conventionRead,
        previousAgencyId: anotherPeAgency.id,
      });

      expectToEqual(franceTravailGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...toExpectedFtConvention(conventionRead),
            agencyValidatorEmails: [],
          },
          previousAgencyId: anotherPeAgency.id,
        },
      ]);
    });

    it("does not broadcast when neither current nor previous agency qualifies", async () => {
      uow.agencyRepository.agencies = [siaeAgency, autreAgency];

      await broadcastToFranceTravailOnConventionUpdates.execute({
        eventType: "CONVENTION_UPDATED",
        convention: conventionReadDtoFrom({
          convention: conventionOnSiaeAgency,
          agency: {
            ...siaeAgency,
            validatorEmails: [],
            counsellorEmails: [],
          },
        }),
        previousAgencyId: autreAgency.id,
      });

      expectToEqual(franceTravailGateway.broadcastParamsCalls, []);
    });

    it("does not broadcast when no previousAgencyId and current agency does not qualify", async () => {
      uow.agencyRepository.agencies = [siaeAgency];

      await broadcastToFranceTravailOnConventionUpdates.execute({
        eventType: "CONVENTION_UPDATED",
        convention: conventionReadDtoFrom({
          convention: conventionOnSiaeAgency,
          agency: {
            ...siaeAgency,
            validatorEmails: [],
            counsellorEmails: [],
          },
        }),
      });

      expectToEqual(franceTravailGateway.broadcastParamsCalls, []);
    });
  });

  type ConvertParams = {
    convention: ConventionDto;
    agency: AgencyDto;
    referredAgency?: AgencyDto;
    assessment?: AssessmentDto;
  };

  const conventionReadDtoFrom = ({
    convention,
    agency,
    referredAgency,
    assessment,
  }: ConvertParams): ConventionReadDto => ({
    ...convention,
    agencyName: agency.name,
    agencyContactEmail: agency.contactEmail,
    agencyDepartment: agency.address.departmentCode,
    agencyKind: agency.kind,
    agencySiret: agency.agencySiret,
    agencyRefersTo: referredAgency && {
      id: referredAgency.id,
      name: referredAgency.name,
      contactEmail: referredAgency.contactEmail,
      kind: referredAgency.kind,
      siret: referredAgency.agencySiret,
    },
    agencyValidationSteps: agency.counsellorEmails.length
      ? "counsellor-and-validator"
      : "validator-only",
    assessment: assessment
      ? {
          status: assessment.status,
          endedWithAJob: assessment.endedWithAJob,
          signedAt: assessment.signedAt,
          createdAt: assessment.createdAt,
        }
      : null,
    lastReminders: makeEmptyLastReminders(),
    isEstablishmentBanned: false,
  });

  const toExpectedFtConvention = (convention: ConventionReadDto) => {
    const { agencyKind, agencyRefersTo, ...rest } = convention;
    return {
      ...rest,
      agencyKind: toPartnerAgencyKind(agencyKind),
      ...(agencyRefersTo
        ? {
            agencyRefersTo: {
              ...agencyRefersTo,
              kind: toPartnerAgencyKind(agencyRefersTo.kind),
            },
          }
        : {}),
    };
  };
});
