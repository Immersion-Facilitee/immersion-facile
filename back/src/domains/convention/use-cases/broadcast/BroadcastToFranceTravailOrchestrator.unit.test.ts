import {
  AgencyDtoBuilder,
  type AgencyId,
  AssessmentDtoBuilder,
  ConventionDtoBuilder,
  type ConventionReadDto,
  expectToEqual,
  makeEmptyLastReminders,
  UserBuilder,
} from "shared";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { createAssessmentEntity } from "../../entities/AssessmentEntity";
import type { BroadcastToFranceTravailOnConventionUpdates } from "./BroadcastToFranceTravailOnConventionUpdates";
import {
  type BroadcastToFranceTravailOrchestrator,
  makeBroadcastToFranceTravailOrchestrator,
} from "./BroadcastToFranceTravailOrchestrator";
import type { BroadcastConventionParams } from "./broadcastConventionParams";

describe("BroadcastToFranceTravailOrchestrator", () => {
  let uow: InMemoryUnitOfWork;
  let standardBroadcastToFT: BroadcastToFranceTravailOnConventionUpdates;
  let standardBroadcastCalls: BroadcastConventionParams[];
  let broadcastToFranceTravailOrchestrator: BroadcastToFranceTravailOrchestrator;

  const validator = new UserBuilder().withEmail("validator@email.fr").build();
  const referredAgency = new AgencyDtoBuilder()
    .withId("referred-agency")
    .build();
  const agency = new AgencyDtoBuilder()
    .withRefersToAgencyInfo({
      refersToAgencyId: referredAgency.id,
      refersToAgencyName: referredAgency.name,
      refersToAgencyContactEmail: referredAgency.contactEmail,
    })
    .build();

  const conventionWithoutAssessment = new ConventionDtoBuilder()
    .withId("11111111-1111-4111-8111-111111111111")
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(agency.id)
    .build();

  const convention = new ConventionDtoBuilder()
    .withStatus("ACCEPTED_BY_VALIDATOR")
    .withAgencyId(agency.id)
    .build();

  const assessment = new AssessmentDtoBuilder()
    .withConventionId(convention.id)
    .build();

  const conventionReadDto: ConventionReadDto = {
    ...convention,
    agencyName: agency.name,
    agencySiret: agency.agencySiret,
    agencyKind: agency.kind,
    agencyContactEmail: agency.contactEmail,
    agencyRefersTo: {
      id: referredAgency.id,
      name: referredAgency.name,
      contactEmail: referredAgency.contactEmail,
      kind: referredAgency.kind,
      siret: referredAgency.agencySiret,
    },
    agencyDepartment: agency.address.departmentCode,
    agencyValidationSteps: "validator-only",
    assessment: {
      status: assessment.status,
      endedWithAJob: assessment.endedWithAJob,
      signedAt: assessment.signedAt,
      createdAt: assessment.createdAt,
    },
    lastReminders: makeEmptyLastReminders(),
    isEstablishmentBanned: false,
  };

  beforeEach(() => {
    ({ standardBroadcastCalls, standardBroadcastToFT } =
      createFakeStandardBroadcastToFT());
    uow = createInMemoryUow();
    broadcastToFranceTravailOrchestrator =
      makeBroadcastToFranceTravailOrchestrator({
        uowPerformer: new InMemoryUowPerformer(uow),
        broadcastToFranceTravailOnConventionUpdates: standardBroadcastToFT,
      });

    uow.conventionRepository.setConventions([
      convention,
      conventionWithoutAssessment,
    ]);
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, convention),
    ];
    uow.userRepository.users = [validator];
    uow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [validator.id]: {
          roles: ["validator"],
          isNotifiedByEmail: true,
        },
      }),
      toAgencyWithRights(referredAgency),
    ];
  });

  it("triggers standard broadcast with assessment when present", async () => {
    await broadcastToFranceTravailOrchestrator.execute({
      conventionId: convention.id,
    });
    expectStandardBroadcastCallsToEqual([
      {
        convention: conventionReadDto,
        assessment,
      },
    ]);
  });

  it("does not include assessment key when convention has no assessment", async () => {
    const conventionReadDtoWithoutAssessment: ConventionReadDto = {
      ...conventionWithoutAssessment,
      agencyName: agency.name,
      agencySiret: agency.agencySiret,
      agencyKind: agency.kind,
      agencyContactEmail: agency.contactEmail,
      agencyRefersTo: {
        id: referredAgency.id,
        name: referredAgency.name,
        contactEmail: referredAgency.contactEmail,
        kind: referredAgency.kind,
        siret: referredAgency.agencySiret,
      },
      agencyDepartment: agency.address.departmentCode,
      agencyValidationSteps: "validator-only",
      assessment: null,
      lastReminders: makeEmptyLastReminders(),
      isEstablishmentBanned: false,
    };

    await broadcastToFranceTravailOrchestrator.execute({
      conventionId: conventionWithoutAssessment.id,
    });

    expectStandardBroadcastCallsToEqual([
      {
        convention: conventionReadDtoWithoutAssessment,
      },
    ]);
  });

  it("does not include assessment key when assessment is legacy", async () => {
    const conventionWithLegacyAssessment = new ConventionDtoBuilder()
      .withId("22222222-2222-4222-8222-222222222222")
      .withStatus("ACCEPTED_BY_VALIDATOR")
      .withAgencyId(agency.id)
      .build();

    uow.conventionRepository.setConventions([
      convention,
      conventionWithoutAssessment,
      conventionWithLegacyAssessment,
    ]);
    uow.assessmentRepository.assessments = [
      createAssessmentEntity(assessment, convention),
      {
        _entityName: "Assessment",
        status: "FINISHED",
        conventionId: conventionWithLegacyAssessment.id,
        establishmentFeedback: "commentaire",
        numberOfHoursActuallyMade: null,
        createdAt: new Date("2023-03-11").toISOString(),
      },
    ];

    await broadcastToFranceTravailOrchestrator.execute({
      conventionId: conventionWithLegacyAssessment.id,
    });

    expectStandardBroadcastCallsToEqual([
      {
        convention: {
          ...conventionWithLegacyAssessment,
          agencyName: agency.name,
          agencySiret: agency.agencySiret,
          agencyKind: agency.kind,
          agencyContactEmail: agency.contactEmail,
          agencyRefersTo: {
            id: referredAgency.id,
            name: referredAgency.name,
            contactEmail: referredAgency.contactEmail,
            kind: referredAgency.kind,
            siret: referredAgency.agencySiret,
          },
          agencyDepartment: agency.address.departmentCode,
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
  });

  it("passes previousAgencyId through to standard broadcast only when provided", async () => {
    const previousAgencyId: AgencyId = "previous-agency-id";
    await broadcastToFranceTravailOrchestrator.execute({
      conventionId: convention.id,
      previousAgencyId,
    });
    expectStandardBroadcastCallsToEqual([
      {
        convention: conventionReadDto,
        previousAgencyId,
        assessment,
      },
    ]);
  });

  const expectStandardBroadcastCallsToEqual = (
    expected: BroadcastConventionParams[],
  ) => {
    expectToEqual(standardBroadcastCalls, expected);
  };
});

const createFakeStandardBroadcastToFT = (): {
  standardBroadcastToFT: BroadcastToFranceTravailOnConventionUpdates;
  standardBroadcastCalls: BroadcastConventionParams[];
} => {
  const standardBroadcastCalls: BroadcastConventionParams[] = [];
  return {
    standardBroadcastCalls,
    standardBroadcastToFT: {
      useCaseName: "BroadcastToFranceTravailOnConventionUpdates",
      execute: async (params) => {
        standardBroadcastCalls.push(params);
      },
    },
  };
};
