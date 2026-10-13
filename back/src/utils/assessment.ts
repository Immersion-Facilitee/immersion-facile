import {
  type AgencyDto,
  type AssessmentDto,
  type AssessmentMode,
  assessmentDtoSchema,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  errors,
  getConventionManageAllowedRoles,
  hasAllowedRoleOnAssessment,
  isEstablishmentTutorIsEstablishmentRepresentative,
  legacyAssessmentDtoSchema,
  type Role,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import { getUserWithRights } from "../domains/connected-users/helpers/userRights.helper";
import type { AssessmentEntity } from "../domains/convention/entities/AssessmentEntity";
import type { UnitOfWork } from "../domains/core/unit-of-work/ports/UnitOfWork";
import { isSomeEmailMatchingEmailHash } from "./jwt";

export const throwForbiddenIfNotAllowedForAssessments = async ({
  mode,
  convention,
  agency,
  jwtPayload,
  uow,
}: {
  mode: AssessmentMode;
  convention: ConventionDto;
  agency: AgencyDto;
  jwtPayload: ConventionRelatedJwtPayload;
  uow: UnitOfWork;
}) => {
  if ("role" in jwtPayload) {
    const { emailHash, applicationId, role } = jwtPayload;
    if (convention.id !== applicationId)
      throw errors.assessment.conventionIdMismatch();

    const emailsOrError = assessmentEmailsByRole(convention, agency, mode)[
      role
    ];

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
  agency: AgencyDto,
  mode: AssessmentMode,
): Record<Role, string[] | Error> => ({
  "back-office": errors.assessment.forbidden(mode),
  "to-review": errors.assessment.forbidden(mode),
  "agency-viewer": errors.assessment.forbidden(mode),
  beneficiary:
    mode === "GetAssessment"
      ? [convention.signatories.beneficiary.email]
      : errors.assessment.forbidden(mode),
  "beneficiary-current-employer": errors.assessment.forbidden(mode),
  "beneficiary-representative":
    mode === "GetAssessment" && convention.signatories.beneficiaryRepresentative
      ? [convention.signatories.beneficiaryRepresentative.email]
      : errors.assessment.forbidden(mode),
  "agency-admin": errors.assessment.forbidden(mode),
  "establishment-representative":
    mode === "GetAssessment" ||
    (mode === "CreateAssessment" &&
      isEstablishmentTutorIsEstablishmentRepresentative(convention))
      ? [convention.signatories.establishmentRepresentative.email]
      : errors.assessment.forbidden(mode),
  "establishment-tutor": [convention.establishmentTutor.email],
  counsellor: agency.counsellorEmails,
  validator: agency.validatorEmails,
  "establishment-admin": errors.assessment.forbidden(mode),
  "establishment-contact": errors.assessment.forbidden(mode),
});
