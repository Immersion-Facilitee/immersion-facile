import { sql } from "kysely";
import type {
  AssessmentStatus,
  ConventionId,
  DateString,
  DateTimeIsoString,
} from "shared";
import { errors, isAssessmentDto } from "shared";
import {
  jsonBuildObject,
  type KyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { assessmentEntitySchema } from "../../../utils/assessment";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import type { AssessmentRepository } from "../ports/AssessmentRepository";

const createAssessmentQueryBuilder = (transaction: KyselyDb) =>
  transaction.selectFrom("immersion_assessments").select((eb) => [
    jsonBuildObject({
      conventionId: eb.ref("convention_id"),
      status: eb.ref("status").$castTo<AssessmentStatus[]>(),
      establishmentFeedback: eb.ref("establishment_feedback"),
      establishmentAdvices: eb.ref("establishment_advices"),
      endedWithAJob: eb.ref("ended_with_a_job"),
      contractStartDate: sql<DateString>`date_to_iso(contract_start_date)`,
      typeOfContract: eb.ref("type_of_contract"),
      lastDayOfPresence: sql<DateString>`date_to_iso(last_day_of_presence)`,
      numberOfMissedHours: eb.ref("number_of_missed_hours"),
      numberOfHoursActuallyMade: eb.ref("number_of_hours_actually_made"),
      beneficiaryAgreement: eb.ref("beneficiary_agreement"),
      beneficiaryFeedback: eb.ref("beneficiary_feedback"),
      signedAt: sql<DateString>`date_to_iso(signed_at)`,
      createdAt: sql<DateTimeIsoString>`date_to_iso(created_at)`,
    }).as("assessment"),
  ]);

const parseAssessmentEntitySchema = (assessment: any) =>
  assessmentEntitySchema.parse({
    _entityName: "Assessment",
    conventionId: assessment.conventionId,
    status: assessment.status,
    establishmentFeedback: assessment.establishmentFeedback,
    establishmentAdvices: assessment.establishmentAdvices,
    endedWithAJob: assessment.endedWithAJob,
    numberOfHoursActuallyMade: assessment.numberOfHoursActuallyMade,
    beneficiaryAgreement: assessment.beneficiaryAgreement,
    beneficiaryFeedback: assessment.beneficiaryFeedback,
    signedAt: assessment.signedAt,
    createdAt: assessment.createdAt,
    ...(assessment.contractStartDate
      ? { contractStartDate: assessment.contractStartDate }
      : {}),
    ...(assessment.typeOfContract
      ? { typeOfContract: assessment.typeOfContract }
      : {}),
    ...(assessment.status === "PARTIALLY_COMPLETED"
      ? { lastDayOfPresence: assessment.lastDayOfPresence }
      : {}),
    ...(assessment.numberOfMissedHours !== null
      ? { numberOfMissedHours: assessment.numberOfMissedHours }
      : {}),
  });

export class PgAssessmentRepository implements AssessmentRepository {
  constructor(private transaction: KyselyDb) {}

  public async delete(conventionId: ConventionId): Promise<void> {
    await this.transaction
      .deleteFrom("immersion_assessments")
      .where("convention_id", "=", conventionId)
      .execute();
  }

  public async getByConventionId(
    conventionId: ConventionId,
  ): Promise<AssessmentEntity | undefined> {
    const result = await createAssessmentQueryBuilder(this.transaction)
      .where("convention_id", "=", conventionId)
      .executeTakeFirst();

    const assessment = result?.assessment;
    if (!assessment) return;

    return parseAssessmentEntitySchema(assessment);
  }

  public async getByConventionIds(
    conventionIds: ConventionId[],
  ): Promise<AssessmentEntity[]> {
    if (conventionIds.length === 0) return [];

    const result = await createAssessmentQueryBuilder(this.transaction)
      .where("convention_id", "in", conventionIds)
      .execute();

    return result.map(({ assessment }) =>
      parseAssessmentEntitySchema(assessment),
    );
  }

  public async update(updatedAssessment: AssessmentEntity): Promise<void> {
    const result = await this.transaction
      .updateTable("immersion_assessments")
      .set(assessmentEntityToDbRow(updatedAssessment))
      .where("convention_id", "=", updatedAssessment.conventionId)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0)
      throw errors.assessment.notFound(updatedAssessment.conventionId);
  }

  public async save(assessmentEntity: AssessmentEntity): Promise<void> {
    await this.transaction
      .insertInto("immersion_assessments")
      .values({
        convention_id: assessmentEntity.conventionId,
        ...assessmentEntityToDbRow(assessmentEntity),
        created_at: new Date(assessmentEntity.createdAt),
      })
      .execute()
      .catch((error) => {
        if (error?.message.includes(noConventionMatchingErrorMessage))
          throw errors.convention.notFound({
            conventionId: assessmentEntity.conventionId,
          });

        if (error?.message.includes(assessmentAlreadyExistsErrorMessage))
          throw errors.assessment.alreadyExist(assessmentEntity.conventionId);

        throw error;
      });
  }
}

const noConventionMatchingErrorMessage =
  '"immersion_assessments" violates foreign key constraint "immersion_assessments_convention_id_fkey"';

const assessmentAlreadyExistsErrorMessage =
  '"immersion_assessments" violates unique constraint "immersion_assessments_pkey"';

const getNonLegacyFields = (assessmentEntity: AssessmentEntity) => {
  if (!("establishmentAdvices" in assessmentEntity)) return {};

  return {
    ended_with_a_job: assessmentEntity.endedWithAJob,
    type_of_contract: assessmentEntity.endedWithAJob
      ? assessmentEntity.typeOfContract
      : null,
    contract_start_date: assessmentEntity.endedWithAJob
      ? assessmentEntity.contractStartDate
      : null,
    establishment_advices: assessmentEntity.establishmentAdvices,
    last_day_of_presence:
      assessmentEntity.status === "PARTIALLY_COMPLETED"
        ? assessmentEntity.lastDayOfPresence
        : null,
    number_of_missed_hours:
      assessmentEntity.status === "PARTIALLY_COMPLETED"
        ? assessmentEntity.numberOfMissedHours
        : null,
  };
};

const assessmentEntityToDbRow = (assessmentEntity: AssessmentEntity) => ({
  status: assessmentEntity.status,
  establishment_feedback: assessmentEntity.establishmentFeedback,
  ...getNonLegacyFields(assessmentEntity),
  number_of_hours_actually_made: assessmentEntity.numberOfHoursActuallyMade,
  ...(isAssessmentDto(assessmentEntity)
    ? {
        beneficiary_agreement: assessmentEntity.beneficiaryAgreement,
        beneficiary_feedback: assessmentEntity.beneficiaryFeedback,
        signed_at: assessmentEntity.signedAt,
      }
    : {
        beneficiary_agreement: null,
        beneficiary_feedback: null,
        signed_at: null,
      }),
});
