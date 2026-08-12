import { uniq } from "ramda";
import {
  type AgencyDto,
  type AgencyId,
  type AgencyKind,
  type AgencyValidationStep,
  type AgencyWithUsersRights,
  type ApiConsumer,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionId,
  type ConventionReadDto,
  type ConventionRelatedJwtPayload,
  type ConventionStatus,
  conventionSchema,
  type DateTimeIsoString,
  errors,
  type FeatureFlags,
  ForbiddenError,
  getConventionManageAllowedRoles,
  isSignatoryRole,
  isValidMobilePhone,
  type Role,
  type Signatories,
  type SignatoryRole,
  signConventionDtoWithRole,
  statusTransitionConfigs,
  type UserWithRights,
} from "shared";
import {
  agencyWithRightToAgencyDto,
  getAgencyValidationSteps,
} from "../../../utils/agency";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { DomainTopic } from "../../core/events/events";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";

export const throwIfTransitionNotAllowed = ({
  targetStatus,
  roles,
  convention,
  agencyValidationSteps,
  hasAssessment,
}: {
  targetStatus: ConventionStatus;
  roles: Role[];
  convention: ConventionDto;
  agencyValidationSteps: AgencyValidationStep;
  hasAssessment: boolean;
}) => {
  const config = statusTransitionConfigs[targetStatus];

  if (
    !oneOfTheRolesIsAllowed({
      allowedRoles: config.validRoles,
      rolesToValidate: roles,
    })
  )
    throw errors.convention.badRoleStatusChange({
      roles,
      status: targetStatus,
      conventionId: convention.id,
    });

  if (!config.validInitialStatuses.includes(convention.status))
    throw errors.convention.badStatusTransition({
      currentStatus: convention.status,
      targetStatus,
    });

  if (targetStatus === "CANCELLED" && hasAssessment)
    throw errors.convention.notAllowedToCancelConventionWithAssessment();

  if (config.refine) {
    const { isError, errorMessage } = config.refine({
      convention,
      agencyValidationSteps,
    });
    if (isError) throw new ForbiddenError(errorMessage);
  }
};

const oneOfTheRolesIsAllowed = ({
  allowedRoles,
  rolesToValidate,
}: {
  allowedRoles: Role[];
  rolesToValidate: Role[];
}) =>
  rolesToValidate.some((roleToValidate) =>
    allowedRoles.includes(roleToValidate),
  );

export const retrieveConventionWithAgency = async (
  uow: UnitOfWork,
  conventionId: ConventionId,
): Promise<{
  agency: AgencyWithUsersRights;
  convention: ConventionDto;
}> => {
  const convention = await uow.conventionRepository.getById(conventionId);
  if (!convention)
    throw errors.convention.notFound({
      conventionId,
    });
  const agency = await uow.agencyRepository.getById(convention.agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId: convention.agencyId });

  return {
    agency,
    convention,
  };
};

export const getAllConventionRecipientsEmail = (
  convention: ConventionDto,
  agency: AgencyDto,
): string[] => {
  const {
    beneficiary,
    beneficiaryRepresentative,
    establishmentRepresentative,
    beneficiaryCurrentEmployer,
  } = convention.signatories;
  const { validatorEmails, counsellorEmails } = agency;
  const { establishmentTutor } = convention;

  const recipientEmails = uniq([
    beneficiary.email,
    establishmentRepresentative.email,
    establishmentTutor.email,
    beneficiaryRepresentative?.email,
    beneficiaryCurrentEmployer?.email,
    ...counsellorEmails,
    ...validatorEmails,
  ]).filter((email): email is string => !!email);

  return recipientEmails;
};

const isAgencyIdInConsumerScope = (
  conventionRead: ConventionReadDto,
  apiConsumer: ApiConsumer,
): boolean => {
  const { scope } = apiConsumer.rights.convention;
  return scope.agencyIds
    ? scope.agencyIds.includes(conventionRead.agencyId) ||
        Boolean(
          conventionRead.agencyRefersTo &&
            scope.agencyIds.includes(conventionRead.agencyRefersTo.id),
        )
    : false;
};

const isAgencyKindInConsumerScope = (
  conventionRead: ConventionReadDto,
  apiConsumer: ApiConsumer,
): boolean => {
  const { scope } = apiConsumer.rights.convention;
  return scope.agencyKinds
    ? scope.agencyKinds.includes(conventionRead.agencyKind) ||
        Boolean(
          conventionRead.agencyRefersTo &&
            scope.agencyKinds.includes(conventionRead.agencyRefersTo.kind),
        )
    : false;
};

export const isConventionInScope = (
  conventionRead: ConventionReadDto,
  apiConsumer: ApiConsumer,
): boolean =>
  isAgencyIdInConsumerScope(conventionRead, apiConsumer) ||
  isAgencyKindInConsumerScope(conventionRead, apiConsumer);

export const throwErrorOnConventionIdMismatch = ({
  requestedConventionId,
  jwtPayload,
}: {
  requestedConventionId: ConventionId;
  jwtPayload: ConventionRelatedJwtPayload;
}) => {
  if (
    "applicationId" in jwtPayload &&
    requestedConventionId !== jwtPayload.applicationId
  )
    throw errors.convention.forbiddenConventionIdMismatch({
      requestedConventionId,
      jwtConventionId: jwtPayload.applicationId,
      jwtRole: jwtPayload.role,
    });
};

export const throwErrorIfSignatoryAlreadySigned = ({
  convention,
  signatoryRole,
  signatoryKey,
}: {
  convention: ConventionDto;
  signatoryRole: SignatoryRole;
  signatoryKey: keyof Signatories;
}) => {
  if (convention.signatories[signatoryKey]?.signedAt) {
    throw errors.convention.signatoryAlreadySigned({
      conventionId: convention.id,
      signatoryRole,
    });
  }
};

export const throwErrorIfSignatoryPhoneNumberNotValid = ({
  convention,
  signatoryRole,
  signatoryKey,
}: {
  convention: ConventionDto;
  signatoryKey: keyof Signatories;
  signatoryRole: SignatoryRole;
}) => {
  if (!convention.signatories[signatoryKey])
    throw errors.convention.missingActor({
      conventionId: convention.id,
      role: signatoryRole,
    });

  if (convention.signatories[signatoryKey]?.phone) {
    throwErrorIfPhoneNumberNotValid({
      conventionId: convention.id,
      phone: convention.signatories[signatoryKey].phone,
      role: signatoryRole,
    });
  }
};

export const throwErrorIfPhoneNumberNotValid = ({
  conventionId,
  phone,
  role,
}: {
  conventionId: ConventionId;
  phone: string;
  role: Role;
}) => {
  if (!isValidMobilePhone(phone))
    throw errors.convention.invalidMobilePhoneNumber({
      conventionId,
      role,
    });
};

export const getLinkedAgenciesFromAgencyId = async (
  uow: UnitOfWork,
  agencyId: AgencyId,
): Promise<{ agency: AgencyDto; refersToAgency: AgencyDto | null }> => {
  const agencyWithRights = await uow.agencyRepository.getById(agencyId);
  if (!agencyWithRights) throw errors.agency.notFound({ agencyId });

  const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);

  if (!agency.refersToAgencyId) return { agency, refersToAgency: null };

  const refersToAgency = await uow.agencyRepository.getById(
    agency.refersToAgencyId,
  );

  if (!refersToAgency)
    throw errors.agency.notFound({ agencyId: agency.refersToAgencyId });

  return {
    agency,
    refersToAgency: await agencyWithRightToAgencyDto(uow, refersToAgency),
  };
};

export const shouldBroadcastToFranceTravail = ({
  agency,
  featureFlags,
  refersToAgency,
}: {
  agency: AgencyDto;
  refersToAgency: AgencyDto | null;
  featureFlags: FeatureFlags;
}): boolean => {
  const isBroadcastToFranceTravailAllowedForKind = (agencyKind: AgencyKind) => {
    if (agency.kind === agencyKind) return true;
    if (refersToAgency && refersToAgency.kind === "pole-emploi") return true;
    return false;
  };

  if (isBroadcastToFranceTravailAllowedForKind("pole-emploi")) return true;

  if (
    featureFlags.enableBroadcastOfMissionLocaleToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("mission-locale")
  )
    return true;

  if (
    featureFlags.enableBroadcastOfConseilDepartementalToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("conseil-departemental")
  )
    return true;

  if (
    featureFlags.enableBroadcastOfCapEmploiToFT.isActive &&
    isBroadcastToFranceTravailAllowedForKind("cap-emploi")
  )
    return true;

  return false;
};

export const getSignatoryRoleAndUserFromJwtPayload = async (
  jwtPayload: ConventionDomainJwtPayload | ConnectedUserDomainJwtPayload,
  uow: UnitOfWork,
  convention: ConventionDto,
): Promise<{ role: Role; userWithRights: UserWithRights | undefined }> => {
  if ("role" in jwtPayload)
    return { role: jwtPayload.role, userWithRights: undefined };

  const userWithRights = await getUserWithRights(uow, jwtPayload.userId);
  const roles = getConventionManageAllowedRoles(convention, userWithRights);
  const role = roles.find(isSignatoryRole);

  if (!role)
    throw errors.convention.connectedUserNotSignatory({
      userId: userWithRights.id,
      conventionId: convention.id,
    });

  return { role, userWithRights };
};

export const signConvention = async ({
  uow,
  convention,
  now,
  role,
}: {
  uow: UnitOfWork;
  convention: ConventionDto;
  now: DateTimeIsoString;
  role: SignatoryRole;
}): Promise<ConventionDto> => {
  const agencyWithRights = await uow.agencyRepository.getById(
    convention.agencyId,
  );
  if (!agencyWithRights)
    throw errors.agency.notFound({ agencyId: convention.agencyId });

  const agencyValidationSteps = getAgencyValidationSteps(agencyWithRights);

  const signedConvention = conventionSchema.parse(
    signConventionDtoWithRole(convention, role, now),
  );
  throwIfTransitionNotAllowed({
    roles: [role],
    targetStatus: signedConvention.status,
    convention,
    agencyValidationSteps,
    hasAssessment: false,
  });
  const signedId = await uow.conventionRepository.update(signedConvention);
  if (!signedId)
    throw errors.convention.notFound({ conventionId: signedConvention.id });

  return signedConvention;
};

export const domainTopicByTargetStatusMap: Partial<
  Record<ConventionStatus, DomainTopic>
> = {
  PARTIALLY_SIGNED: "ConventionPartiallySigned",
  IN_REVIEW: "ConventionFullySigned",
};

export const extractUserRolesOnConventionFromJwtPayload = async (
  jwtPayload: ConventionDomainJwtPayload | ConnectedUserDomainJwtPayload,
  uow: UnitOfWork,
  initialConvention: ConventionDto,
): Promise<Role[]> => {
  if ("role" in jwtPayload) {
    if (jwtPayload.applicationId !== initialConvention.id)
      throw errors.convention.forbiddenConventionIdMismatch({
        requestedConventionId: initialConvention.id,
        jwtConventionId: jwtPayload.applicationId,
        jwtRole: jwtPayload.role,
      });
    return [jwtPayload.role];
  }

  const userWithRights = await getUserWithRights(uow, jwtPayload.userId);
  return getConventionManageAllowedRoles(initialConvention, userWithRights);
};
