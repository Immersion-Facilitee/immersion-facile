import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  AssessmentDtoBuilder,
  ConventionDtoBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../utils/agency";
import { makeUniqueUserForTest } from "../../../utils/user";
import { PgAgencyRepository } from "../../agency/adapters/PgAgencyRepository";
import { PgUserRepository } from "../../core/authentication/connected-user/adapters/PgUserRepository";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import { PgAssessmentRepository } from "./PgAssessmentRepository";
import { PgConventionRepository } from "./PgConventionRepository";

const conventionId = "aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa";

const convention = new ConventionDtoBuilder().withId(conventionId).build();

const minimalAssessment: AssessmentEntity = {
  ...new AssessmentDtoBuilder().withMinimalInformations().build(),
  _entityName: "Assessment",
  numberOfHoursActuallyMade: convention.schedule.totalHours,
  beneficiaryAgreement: null,
  beneficiaryFeedback: null,
  signedAt: null,
};

const fullAssessment: AssessmentEntity = {
  ...new AssessmentDtoBuilder().withFullInformations().build(),
  _entityName: "Assessment",
  numberOfHoursActuallyMade: convention.schedule.totalHours,
  beneficiaryAgreement: null,
  beneficiaryFeedback: null,
  signedAt: null,
};

describe("PgAssessmentRepository", () => {
  let pool: Pool;
  let db: KyselyDb;
  let assessmentRepository: PgAssessmentRepository;
  const validator = makeUniqueUserForTest(uuid());

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);

    await db.deleteFrom("conventions").execute();
    await db.deleteFrom("convention_drafts").execute();
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("agency_groups__agencies").execute();
    await db.deleteFrom("agency_groups").execute();
    await db.deleteFrom("agencies").execute();

    await new PgUserRepository(db).save(validator);
    await new PgAgencyRepository(db).insert(
      toAgencyWithRights(AgencyDtoBuilder.create().build(), {
        [validator.id]: { isNotifiedByEmail: true, roles: ["validator"] },
      }),
    );
    await new PgConventionRepository(db).save(convention);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    assessmentRepository = new PgAssessmentRepository(db);
    await db.deleteFrom("immersion_assessments").execute();
  });

  describe("save", () => {
    it("fails to save when it does not match an existing Convention", async () => {
      const conventionId = "40400c99-9c0b-bbbb-bb6d-6bb9bd300404";
      await expectPromiseToFailWithError(
        assessmentRepository.save({
          ...minimalAssessment,
          conventionId,
        }),
        errors.convention.notFound({ conventionId }),
      );
    });

    it("saves a minimal assessment", async () => {
      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        undefined,
      );

      await assessmentRepository.save(minimalAssessment);

      expect(
        await db.selectFrom("immersion_assessments").selectAll().execute(),
      ).toHaveLength(1);
      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        minimalAssessment,
      );
    });

    it("saves a full assessment", async () => {
      expectToEqual(
        await assessmentRepository.getByConventionId(
          fullAssessment.conventionId,
        ),
        undefined,
      );

      await assessmentRepository.save(fullAssessment);

      expect(
        await db.selectFrom("immersion_assessments").selectAll().execute(),
      ).toHaveLength(1);
      const savedAssessment = await assessmentRepository.getByConventionId(
        fullAssessment.conventionId,
      );
      expectToEqual(savedAssessment, fullAssessment);
    });

    it("saves an assessment created by a connected user", async () => {
      const assessmentCreatedByValidator: AssessmentEntity = {
        ...fullAssessment,
        createdBy: { role: "validator", userId: validator.id },
      };

      await assessmentRepository.save(assessmentCreatedByValidator);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          assessmentCreatedByValidator.conventionId,
        ),
        assessmentCreatedByValidator,
      );
    });

    it("saves an assessment created through a convention magic link", async () => {
      const assessmentCreatedByTutor: AssessmentEntity = {
        ...fullAssessment,
        createdBy: { role: "establishment-tutor", userId: null },
      };

      await assessmentRepository.save(assessmentCreatedByTutor);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          assessmentCreatedByTutor.conventionId,
        ),
        assessmentCreatedByTutor,
      );
    });
  });

  describe("getByConventionId", () => {
    it("returns undefined if no Convention where found", async () => {
      expectToEqual(
        await assessmentRepository.getByConventionId(
          "40400c99-9c0b-bbbb-bb6d-6bb9bd300404",
        ),
        undefined,
      );
    });

    it("returns assessment found", async () => {
      await assessmentRepository.save(minimalAssessment);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        minimalAssessment,
      );
    });

    it("returns partially completed assessment with 0 missed hours", async () => {
      const assessment: AssessmentEntity = {
        conventionId: "aaaaac99-9c0b-1bbb-bb6d-6bb9bd38aaaa",
        status: "PARTIALLY_COMPLETED",
        numberOfMissedHours: 0,
        lastDayOfPresence: new Date("2024-10-17").toISOString(),
        endedWithAJob: false,
        establishmentFeedback: "Ca s'est bien passé",
        establishmentAdvices: "mon conseil",
        numberOfHoursActuallyMade: 404,
        _entityName: "Assessment",
        beneficiaryAgreement: null,
        beneficiaryFeedback: null,
        signedAt: null,
        createdAt: new Date().toISOString(),
      };

      await assessmentRepository.save(assessment);

      expectToEqual(
        await assessmentRepository.getByConventionId(assessment.conventionId),
        assessment,
      );
    });

    it("returns assessment found with all fields", async () => {
      await assessmentRepository.save(fullAssessment);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          fullAssessment.conventionId,
        ),
        fullAssessment,
      );
    });
  });

  describe("getByConventionIds", () => {
    it("returns assessment found", async () => {
      await assessmentRepository.save(minimalAssessment);

      expectToEqual(
        await assessmentRepository.getByConventionIds([
          minimalAssessment.conventionId,
        ]),
        [minimalAssessment],
      );
    });
  });

  describe("update", () => {
    it("updates assessment", async () => {
      const signedAt = new Date("2024-06-15").toISOString();
      await assessmentRepository.save(minimalAssessment);

      const updatedAssessment: AssessmentEntity = {
        ...minimalAssessment,
        status: "PARTIALLY_COMPLETED",
        numberOfMissedHours: 7,
        lastDayOfPresence: new Date("2024-10-17").toISOString(),
        endedWithAJob: false,
        establishmentFeedback: "updated feedback",
        establishmentAdvices: "updated advices",
        numberOfHoursActuallyMade: 35,
        beneficiaryAgreement: true,
        beneficiaryFeedback: "Mon commentaire",
        signedAt: signedAt,
      };

      await assessmentRepository.update(updatedAssessment);

      const updatedAssessmentStored =
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        );
      expectToEqual(updatedAssessmentStored, updatedAssessment);
    });

    it("keeps the assessment creator on update", async () => {
      const assessmentCreatedByTutor: AssessmentEntity = {
        ...minimalAssessment,
        createdBy: { role: "establishment-tutor", userId: null },
      };
      await assessmentRepository.save(assessmentCreatedByTutor);

      const signedAssessment: AssessmentEntity = {
        ...assessmentCreatedByTutor,
        beneficiaryAgreement: true,
        beneficiaryFeedback: "Mon commentaire",
        signedAt: new Date("2024-06-15").toISOString(),
      };
      await assessmentRepository.update(signedAssessment);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        signedAssessment,
      );
    });

    it("throws when assessment does not exist", async () => {
      const nonExistentConventionId = "bbbbbc99-9c0b-1bbb-bb6d-6bb9bd38bbbb";

      await expectPromiseToFailWithError(
        assessmentRepository.update({
          _entityName: "Assessment",
          endedWithAJob: false,
          establishmentFeedback: "super feedback",
          establishmentAdvices: "devam et",
          numberOfHoursActuallyMade: 43,
          status: "COMPLETED",
          conventionId: nonExistentConventionId,
          beneficiaryAgreement: true,
          beneficiaryFeedback: "",
          signedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }),
        errors.assessment.notFound(nonExistentConventionId),
      );
    });
  });

  describe("delete", () => {
    it("deletes the assessment of the given conventionId", async () => {
      await assessmentRepository.save(minimalAssessment);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        minimalAssessment,
      );

      await assessmentRepository.delete(minimalAssessment.conventionId);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        undefined,
      );
    });

    it("does not throw when assessment already deleted (idempotent)", async () => {
      await assessmentRepository.save(minimalAssessment);
      await assessmentRepository.delete(minimalAssessment.conventionId);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        undefined,
      );

      await assessmentRepository.delete(minimalAssessment.conventionId);

      expectToEqual(
        await assessmentRepository.getByConventionId(
          minimalAssessment.conventionId,
        ),
        undefined,
      );
    });
  });
});
