import subDays from "date-fns/subDays";
import {
  AgencyDtoBuilder,
  type AssessmentDto,
  ConventionDtoBuilder,
  errors,
  expectToEqual,
  makeEmptyLastReminders,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryFranceTravailGateway } from "../adapters/france-travail-gateway/InMemoryFranceTravailGateway";
import { makeBroadcastToFranceTravailOnConventionUpdates } from "./broadcast/BroadcastToFranceTravailOnConventionUpdates";
import {
  makeResyncOldConventionsToFt,
  type ResyncOldConventionsToFt,
} from "./ResyncOldConventionsToFt";

describe("ResyncOldConventionsToFt use case", () => {
  const agencyFT = new AgencyDtoBuilder().withKind("france-travail").build();
  const conventionToSync1 = new ConventionDtoBuilder()
    .withId("6f59c7b7-c2c9-4a31-a3eb-377ea83ae08b")
    .withAgencyId(agencyFT.id)
    .build();
  const conventionToSync2 = new ConventionDtoBuilder()
    .withId("6f59c7b7-c2c9-4a31-a3eb-377ea83ae08a")
    .withAgencyId(agencyFT.id)
    .build();
  const conventionToSync3 = new ConventionDtoBuilder()
    .withId("6f59c7b7-c2c9-4a31-a3eb-377ea83ae08d")
    .withAgencyId(agencyFT.id)
    .build();
  const conventionToSync4 = new ConventionDtoBuilder()
    .withId("6f59c7b7-c2c9-4a31-a3eb-377ea83ae08e")
    .withAgencyId(agencyFT.id)
    .build();

  let uow: InMemoryUnitOfWork;
  let useCase: ResyncOldConventionsToFt;
  let timeGateway: CustomTimeGateway;
  let ftGateway: InMemoryFranceTravailGateway;

  beforeEach(() => {
    uow = createInMemoryUow();

    const uowPerformer = new InMemoryUowPerformer(uow);

    timeGateway = new CustomTimeGateway();
    ftGateway = new InMemoryFranceTravailGateway();
    useCase = makeResyncOldConventionsToFt({
      uowPerformer,
      deps: {
        limit: 100,
        standardBroadcastToFTUsecase:
          makeBroadcastToFranceTravailOnConventionUpdates({
            uowPerformer,
            deps: {
              franceTravailGateway: ftGateway,
              timeGateway,
              options: { resyncMode: true },
            },
          }),
        timeGateway,
      },
    });
  });

  describe("Right paths", () => {
    it("broadcast two conventions to FT", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([
        conventionToSync1,
        conventionToSync2,
      ]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
        {
          id: conventionToSync2.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, [
        conventionToSync1,
        conventionToSync2,
      ]);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
        {
          id: conventionToSync2.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
      ]);
      expectToEqual(ftGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync1,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync2,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
      expectToEqual(report, {
        success: 2,
        skips: {},
        errors: {},
      });
    });

    it("no convention to sync", async () => {
      uow.conventionsToSyncRepository.setForTesting([]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, []);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, []);
      expectToEqual(ftGateway.broadcastParamsCalls, []);
      expectToEqual(report, {
        success: 0,
        skips: {},
        errors: {},
      });
    });

    it("when agency is not kind france-travail", async () => {
      const agencyCCI = new AgencyDtoBuilder().withKind("cci").build();
      const conventionToSync = new ConventionDtoBuilder()
        .withAgencyId(agencyCCI.id)
        .build();
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyCCI)];
      uow.conventionRepository.setConventions([conventionToSync]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, [conventionToSync]);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync.id,
          status: "SKIP",
          processDate: timeGateway.now(),
          reason: "Agency is not of kind france-travail",
        },
      ]);
      expectToEqual(report, {
        success: 0,
        skips: {
          [conventionToSync.id]: "Agency is not of kind france-travail",
        },
        errors: {},
      });
    });

    it("only process convention with status TO_PROCESS and ERROR", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([
        conventionToSync1,
        conventionToSync2,
        conventionToSync3,
        conventionToSync4,
      ]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
        {
          id: conventionToSync2.id,
          status: "ERROR",
          processDate: subDays(timeGateway.now(), 1),
          reason: "Random error",
        },
        {
          id: conventionToSync3.id,
          status: "SKIP",
          processDate: subDays(timeGateway.now(), 1),
          reason: "Feature flag enablePeConventionBroadcast not enabled",
        },
        {
          id: conventionToSync4.id,
          status: "SUCCESS",
          processDate: subDays(timeGateway.now(), 1),
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, [
        conventionToSync1,
        conventionToSync2,
        conventionToSync3,
        conventionToSync4,
      ]);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
        {
          id: conventionToSync2.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
        {
          id: conventionToSync3.id,
          status: "SKIP",
          processDate: subDays(timeGateway.now(), 1),
          reason: "Feature flag enablePeConventionBroadcast not enabled",
        },
        {
          id: conventionToSync4.id,
          status: "SUCCESS",
          processDate: subDays(timeGateway.now(), 1),
        },
      ]);
      expectToEqual(ftGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync1,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync2,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
      expectToEqual(report, {
        success: 2,
        skips: {},
        errors: {},
      });
    });

    it("when broadcast times out, keeps TO_PROCESS for a later resync run", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([conventionToSync1]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);
      ftGateway.setNextResponse({
        status: 500,
        subscriberErrorFeedback: {
          message: "timeout of 30000ms exceeded",
          error: new Error("timeout of 30000ms exceeded"),
        },
        body: undefined,
      });

      const report = await useCase.execute();

      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);
      expectToEqual(report, {
        success: 0,
        skips: {},
        errors: {
          [conventionToSync1.id]: new Error(
            "Convention still have status TO_PROCESS",
          ),
        },
      });
    });

    it("should consider limit", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([
        conventionToSync1,
        conventionToSync2,
      ]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
        {
          id: conventionToSync2.id,
          status: "TO_PROCESS",
        },
      ]);

      const uowPerformer = new InMemoryUowPerformer(uow);
      const report = await makeResyncOldConventionsToFt({
        uowPerformer,
        deps: {
          limit: 1,
          standardBroadcastToFTUsecase:
            makeBroadcastToFranceTravailOnConventionUpdates({
              uowPerformer,
              deps: {
                franceTravailGateway: ftGateway,
                timeGateway,
                options: { resyncMode: true },
              },
            }),
          timeGateway,
        },
      }).execute();

      expectToEqual(uow.conventionRepository.conventions, [
        conventionToSync1,
        conventionToSync2,
      ]);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
        {
          id: conventionToSync2.id,
          status: "TO_PROCESS",
        },
      ]);
      expectToEqual(ftGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync1,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: null,
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
      expectToEqual(report, {
        success: 1,
        skips: {},
        errors: {},
      });
    });

    it("also broadcast assessment if it is AssessmentDTO", async () => {
      const assessment: AssessmentDto = {
        conventionId: conventionToSync1.id,
        status: "COMPLETED",
        endedWithAJob: false,
        establishmentFeedback: "commentaire",
        establishmentAdvices: "commentaire",
        beneficiaryAgreement: true,
        beneficiaryFeedback: "my super feedback",
        signedAt: new Date("2025-01-01").toISOString(),
        createdAt: new Date("2025-01-01").toISOString(),
      };
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([conventionToSync1]);
      uow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          numberOfHoursActuallyMade: null,
          ...assessment,
        },
      ];
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
      ]);
      expectToEqual(ftGateway.broadcastParamsCalls, [
        {
          eventType: "ASSESSMENT_CREATED",
          assessment,
          convention: {
            ...conventionToSync1,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyKind: "pole-emploi",
            agencyContactEmail: agencyFT.contactEmail,
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: assessment.status,
              endedWithAJob: assessment.endedWithAJob,
              signedAt: assessment.signedAt,
              createdAt: assessment.createdAt,
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
      expectToEqual(report, {
        success: 1,
        skips: {},
        errors: {},
      });
    });

    it("should not broadcast assessment if it is LegacyAssessmentDto", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionRepository.setConventions([conventionToSync1]);
      uow.assessmentRepository.assessments = [
        {
          _entityName: "Assessment",
          status: "FINISHED",
          conventionId: conventionToSync1.id,
          establishmentFeedback: "commentaire",
          numberOfHoursActuallyMade: null,
          createdAt: new Date("2023-03-11").toISOString(),
        },
      ];
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "SUCCESS",
          processDate: timeGateway.now(),
        },
      ]);
      expectToEqual(ftGateway.broadcastParamsCalls, [
        {
          eventType: "CONVENTION_UPDATED",
          convention: {
            ...conventionToSync1,
            agencyName: agencyFT.name,
            agencyDepartment: agencyFT.address.departmentCode,
            agencyContactEmail: agencyFT.contactEmail,
            agencyKind: "pole-emploi",
            agencySiret: agencyFT.agencySiret,
            agencyValidatorEmails: agencyFT.validatorEmails,
            agencyValidationSteps: "validator-only",
            assessment: {
              status: "FINISHED",
              createdAt: new Date("2023-03-11").toISOString(),
            },
            lastReminders: makeEmptyLastReminders(),
            isEstablishmentBanned: false,
          },
        },
      ]);
      expectToEqual(report, {
        success: 1,
        skips: {},
        errors: {},
      });
    });
  });

  describe("Wrong paths", () => {
    it("when no convention in conventionRepository should not sync convention", async () => {
      uow.agencyRepository.agencies = [toAgencyWithRights(agencyFT)];
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, []);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "ERROR",
          processDate: timeGateway.now(),
          reason: errors.convention.notFound({
            conventionId: conventionToSync1.id,
          }).message,
        },
      ]);
      expectToEqual(report, {
        success: 0,
        skips: {},
        errors: {
          [conventionToSync1.id]: errors.convention.notFound({
            conventionId: conventionToSync1.id,
          }),
        },
      });
    });

    it("when no agency", async () => {
      uow.conventionRepository.setConventions([conventionToSync1]);
      uow.conventionsToSyncRepository.setForTesting([
        {
          id: conventionToSync1.id,
          status: "TO_PROCESS",
        },
      ]);

      const report = await useCase.execute();

      expectToEqual(uow.conventionRepository.conventions, [conventionToSync1]);
      expectToEqual(uow.conventionsToSyncRepository.conventionsToSync, [
        {
          id: conventionToSync1.id,
          status: "ERROR",
          processDate: timeGateway.now(),
          reason: errors.agencies.notFound({
            missingAgencyIds: [agencyFT.id],
            presentAgencyIds: [],
          }).message,
        },
      ]);
      expectToEqual(report, {
        success: 0,
        skips: {},
        errors: {
          [conventionToSync1.id]: errors.agencies.notFound({
            missingAgencyIds: [agencyFT.id],
            presentAgencyIds: [],
          }),
        },
      });
    });
  });
});
