import {
  type AssessmentDto,
  type AssessmentMode,
  assessmentDtoSchema,
  type ConventionActorRole,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  errors,
  getConventionManageAllowedRoles,
  hasAllowedRoleOnAssessment,
  isEstablishmentTutorIsEstablishmentRepresentative,
  legacyAssessmentDtoSchema,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import { getUserWithRights } from "../domains/connected-users/helpers/userRights.helper";
import type { AssessmentEntity } from "../domains/convention/entities/AssessmentEntity";
import type { UnitOfWork } from "../domains/core/unit-of-work/ports/UnitOfWork";
import { isSomeEmailMatchingEmailHash } from "./emailHash";

export const throwForbiddenIfNotAllowedForAssessments = async ({
  mode,
  convention,
  jwtPayload,
  uow,
}: {
  mode: AssessmentMode;
  convention: ConventionDto;
  jwtPayload: ConventionRelatedJwtPayload;
  uow: UnitOfWork;
}) => {
  if ("role" in jwtPayload) {
    const { emailHash, applicationId, role } = jwtPayload;
    if (convention.id !== applicationId)
      throw errors.assessment.conventionIdMismatch();

    const emailsOrError = assessmentEmailsByRole(convention, mode)[role];

    if (emailsOrError instanceof Error) throw emailsOrError;
    if (!isSomeEmailMatchingEmailHash(emailsOrError, emailHash))
      throw errors.assessment.forbidden(mode);
  }

  if ("userId" in jwtPayload) {
    const user = await getUserWithRights(uow, jwtPayload.userId);
    if (user.isBackofficeAdmin && mode === "GetAssessment") return;
    const userRolesOnConvention = getConventionManageAllowedRoles(
      convention,
      user,
    );
    if (!hasAllowedRoleOnAssessment(userRolesOnConvention, mode, convention))
      throw errors.assessment.forbidden(mode);
  }
};

export const assessmentEntitySchema: ZodSchemaWithInputMatchingOutput<AssessmentEntity> =
  (assessmentDtoSchema as ZodSchemaWithInputMatchingOutput<AssessmentDto>)
    .or(legacyAssessmentDtoSchema)
    .and(
      z.object({
        _entityName: z.literal("Assessment"),
        numberOfHoursActuallyMade: z.number().or(z.null()),
      }),
    );

const assessmentEmailsByRole = (
  convention: ConventionDto,
  mode: AssessmentMode,
): Record<ConventionActorRole, string[] | Error> => ({
  beneficiary:
    mode === "GetAssessment"
      ? [convention.signatories.beneficiary.email]
      : errors.assessment.forbidden(mode),
  "beneficiary-current-employer": errors.assessment.forbidden(mode),
  "beneficiary-representative":
    mode === "GetAssessment" && convention.signatories.beneficiaryRepresentative
      ? [convention.signatories.beneficiaryRepresentative.email]
      : errors.assessment.forbidden(mode),
  "establishment-representative":
    mode === "GetAssessment" ||
    (mode === "CreateAssessment" &&
      isEstablishmentTutorIsEstablishmentRepresentative(convention))
      ? [convention.signatories.establishmentRepresentative.email]
      : errors.assessment.forbidden(mode),
  "establishment-tutor": [convention.establishmentTutor.email],
});
