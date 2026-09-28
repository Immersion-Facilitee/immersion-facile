import {
  type AssessmentDto,
  type allowedRolesToCreateAssessment,
  type ConventionDto,
  type ConventionStatus,
  calculateTotalImmersionHoursBetweenDateComplex,
  type Email,
  errors,
  type Firstname,
  isAssessmentDto,
  type Lastname,
  type LegacyAssessmentDto,
  type UserId,
} from "shared";
import type { EntityFromDto } from "../../../utils/EntityFromDto";

export type AssessmentCreatorRole =
  (typeof allowedRolesToCreateAssessment)[number];

export type AssessmentCreator = {
  role: AssessmentCreatorRole;
  email: Email;
  firstName: Firstname;
  lastName: Lastname;
  userId?: UserId;
};

export type AssessmentEntity = EntityFromDto<
  AssessmentDto | LegacyAssessmentDto,
  "Assessment"
> & {
  numberOfHoursActuallyMade: number | null;
  createdBy?: AssessmentCreator;
};

export const acceptedConventionStatusesForAssessment: ConventionStatus[] = [
  "ACCEPTED_BY_VALIDATOR",
];

const calculateNumberOfHoursActuallyMade = (
  assessment: AssessmentDto,
  convention: ConventionDto,
): number => {
  if (assessment.status === "DID_NOT_SHOW") return 0;
  if (assessment.status === "COMPLETED") return convention.schedule.totalHours;

  return (
    calculateTotalImmersionHoursBetweenDateComplex({
      complexSchedule: convention.schedule.complexSchedule,
      dateStart: convention.dateStart,
      dateEnd: assessment.lastDayOfPresence ?? convention.dateEnd,
    }) - assessment.numberOfMissedHours
  );
};

export const createAssessmentEntity = (
  assessment: AssessmentDto,
  convention: ConventionDto,
): AssessmentEntity => {
  if (!acceptedConventionStatusesForAssessment.includes(convention.status))
    throw errors.assessment.badStatus(convention.status);

  return {
    _entityName: "Assessment",
    ...assessment,
    numberOfHoursActuallyMade: calculateNumberOfHoursActuallyMade(
      assessment,
      convention,
    ),
  };
};

export const toAssessmentDto = ({
  _entityName,
  numberOfHoursActuallyMade: _numberOfHoursActuallyMade,
  createdBy: _createdBy,
  ...assessmentEntity
}: AssessmentEntity): AssessmentDto | LegacyAssessmentDto => assessmentEntity;

export const getOnlyAssessmentDto = (
  assessmentEntity: AssessmentEntity,
): AssessmentDto | undefined => {
  const assessment = toAssessmentDto(assessmentEntity);

  return isAssessmentDto(assessment) ? assessment : undefined;
};
