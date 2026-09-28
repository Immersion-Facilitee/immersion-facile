import { keys } from "ramda";
import {
  type AgencyModifierRole,
  type AgencyWithUsersRights,
  type AssessmentDto,
  allowedRolesToCreateAssessment,
  assessmentDtoSchema,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  calculateTotalImmersionHoursBetweenDateComplex,
  type EmailHash,
  errors,
  ForbiddenError,
  getConventionManageAllowedRoles,
  type Role,
  type User,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { throwForbiddenIfNotAllowedForAssessments } from "../../../utils/assessment";
import { makeEmailHash } from "../../../utils/jwt";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { TriggeredBy } from "../../core/events/events";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  type AssessmentCreator,
  type AssessmentCreatorRole,
  type AssessmentEntity,
  createAssessmentEntity,
} from "../entities/AssessmentEntity";
import { retrieveConventionWithAgency } from "../entities/Convention";

type WithCreateNewEvent = { createNewEvent: CreateNewEvent };

export type CreateAssessment = ReturnType<typeof makeCreateAssessment>;
export const makeCreateAssessment = useCaseBuilder("CreateAssessment")
  .withInput<AssessmentDto>(assessmentDtoSchema)
  .withOutput<void>()
  .withCurrentUser<ConventionRelatedJwtPayload | undefined>()
  .withDeps<WithCreateNewEvent>()
  .build(
    async ({
      inputParams: assessment,
      uow,
      deps,
      currentUser: conventionJwtPayload,
    }) => {
      if (!conventionJwtPayload)
        throw new ForbiddenError("No magic link provided");

      const { agency, convention } = await retrieveConventionWithAgency(
        uow,
        assessment.conventionId,
      );

      await throwForbiddenIfNotAllowedForAssessments({
        mode: "CreateAssessment",
        convention,
        agency: await agencyWithRightToAgencyDto(uow, agency),
        jwtPayload: conventionJwtPayload,
        uow,
      });

      if (
        assessment.status === "PARTIALLY_COMPLETED" &&
        assessment.lastDayOfPresence &&
        (new Date(assessment.lastDayOfPresence) <
          new Date(convention.dateStart) ||
          new Date(assessment.lastDayOfPresence) > new Date(convention.dateEnd))
      ) {
        throw errors.assessment.lastDayOfPresenceNotInConventionRange();
      }

      if (
        assessment.endedWithAJob === true &&
        convention.dateStart > assessment.contractStartDate
      )
        throw errors.assessment.contractStartDateBeforeImmersionStart({
          immersionDateStart: convention.dateStart,
        });

      const scheduledHours = calculateTotalImmersionHoursBetweenDateComplex({
        complexSchedule: convention.schedule.complexSchedule,
        dateStart: convention.dateStart,
        dateEnd:
          assessment.status === "PARTIALLY_COMPLETED"
            ? (assessment.lastDayOfPresence ?? convention.dateEnd)
            : convention.dateEnd,
      });

      if (
        assessment.status === "PARTIALLY_COMPLETED" &&
        assessment.numberOfMissedHours > scheduledHours
      )
        throw errors.assessment.numberOfMissedHoursExceedsScheduled();

      const assessmentEntity: AssessmentEntity = {
        ...(await createAssessmentEntityIfNotExist(
          uow,
          convention,
          assessment,
        )),
        createdBy: await getAssessmentCreator({
          uow,
          convention,
          agency,
          conventionJwtPayload,
        }),
      };

      const triggeredBy: TriggeredBy =
        "role" in conventionJwtPayload
          ? {
              kind: "convention-magic-link",
              role: conventionJwtPayload.role,
            }
          : {
              kind: "connected-user",
              userId: conventionJwtPayload.userId,
            };
      await uow.assessmentRepository.save(assessmentEntity);
      await uow.outboxRepository.save(
        deps.createNewEvent({
          topic: "AssessmentCreated",
          payload: {
            convention,
            assessment,
            triggeredBy,
          },
        }),
      );
    },
  );

const createAssessmentEntityIfNotExist = async (
  uow: UnitOfWork,
  convention: ConventionDto,
  assessment: AssessmentDto,
): Promise<AssessmentEntity> => {
  const existingAssessmentEntity =
    await uow.assessmentRepository.getByConventionId(convention.id);

  if (existingAssessmentEntity)
    throw errors.assessment.alreadyExist(convention.id);

  return createAssessmentEntity(assessment, convention);
};

const getAssessmentCreator = async ({
  uow,
  convention,
  agency,
  conventionJwtPayload,
}: {
  uow: UnitOfWork;
  convention: ConventionDto;
  agency: AgencyWithUsersRights;
  conventionJwtPayload: ConventionRelatedJwtPayload;
}): Promise<AssessmentCreator> => {
  if (!("role" in conventionJwtPayload)) {
    const user = await getUserWithRights(uow, conventionJwtPayload.userId);
    return {
      role: toAssessmentCreatorRole(
        getConventionManageAllowedRoles(convention, user),
      ),
      ...toAssessmentCreatorIdentity(user),
    };
  }

  const role = toAssessmentCreatorRole([conventionJwtPayload.role]);

  if (role === "establishment-tutor") {
    const { email, firstName, lastName } = convention.establishmentTutor;
    return { role, email, firstName, lastName };
  }

  return {
    role,
    ...toAssessmentCreatorIdentity(
      await getAgencyUserMatchingEmailHash({
        uow,
        agency,
        role,
        emailHash: conventionJwtPayload.emailHash,
      }),
    ),
  };
};

const toAssessmentCreatorIdentity = ({
  id,
  email,
  firstName,
  lastName,
}: User): Omit<AssessmentCreator, "role"> => ({
  userId: id,
  email,
  firstName,
  lastName,
});

const getAgencyUserMatchingEmailHash = async ({
  uow,
  agency,
  role,
  emailHash,
}: {
  uow: UnitOfWork;
  agency: AgencyWithUsersRights;
  role: AgencyModifierRole;
  emailHash: EmailHash;
}): Promise<User> => {
  const agencyUserIdsWithRole = keys(agency.usersRights).filter((userId) =>
    agency.usersRights[userId]?.roles.includes(role),
  );
  const agencyUsersWithRole = await uow.userRepository.getByIds(
    agencyUserIdsWithRole,
  );
  const agencyUser = agencyUsersWithRole.find(
    (user) => makeEmailHash(user.email) === emailHash,
  );
  if (!agencyUser) throw errors.assessment.forbidden("CreateAssessment");
  return agencyUser;
};

const toAssessmentCreatorRole = (
  rolesOnConvention: Role[],
): AssessmentCreatorRole => {
  const creatorRole = allowedRolesToCreateAssessment.find((role) =>
    rolesOnConvention.includes(role),
  );
  if (creatorRole) return creatorRole;
  if (rolesOnConvention.includes("establishment-representative"))
    return "establishment-tutor";
  throw errors.assessment.forbidden("CreateAssessment");
};
