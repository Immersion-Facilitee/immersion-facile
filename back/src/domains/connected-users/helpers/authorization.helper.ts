import {
  type AgencyDto,
  type AgencyId,
  type AgencyWithUsersRights,
  type ConnectedUser,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  closedOrRejectedAgencyStatuses,
  errors,
  getConventionManageAllowedRoles,
  type Role,
  type UserWithAdminRights,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { conventionEmailsByRole } from "../../../utils/convention";
import {
  isHashMatchPeAdvisorEmail,
  isSomeEmailMatchingEmailHash,
} from "../../../utils/emailHash";
import { throwErrorOnConventionIdMismatch } from "../../convention/entities/Convention";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { getUserWithRights } from "./userRights.helper";

export const throwIfNotAdmin = (user: UserWithAdminRights | undefined) => {
  if (!user) throw errors.user.unauthorized();
  if (!user.isBackofficeAdmin) throw errors.user.forbidden({ userId: user.id });
};

export const throwIfNotAgencyAdminOrBackofficeAdmin = ({
  agencyIds,
  currentUser,
}: {
  agencyIds: AgencyId[];
  currentUser?: ConnectedUser;
}): void => {
  if (!currentUser) throw errors.user.unauthorized();
  if (currentUser.isBackofficeAdmin) return;

  const hasPermission = agencyIds.every((agencyId) =>
    currentUser.agencyRights.some(
      (agencyRight) =>
        agencyRight.agency.id === agencyId &&
        agencyRight.roles.includes("agency-admin") &&
        !closedOrRejectedAgencyStatuses.includes(agencyRight.agency.status),
    ),
  );
  if (!hasPermission) throw errors.user.forbidden({ userId: currentUser.id });
};

export const throwIfNotAuthorizedForRole = async ({
  uow,
  jwtPayload,
  authorizedRoles,
  errorToThrow,
  convention,
  agencyWithUserRights,
  isPeAdvisorAllowed,
  isValidatorOfAgencyRefersToAllowed,
}: {
  uow: UnitOfWork;
  jwtPayload: ConventionRelatedJwtPayload;
  authorizedRoles: Role[];
  errorToThrow: Error;
  convention: ConventionDto;
  agencyWithUserRights: AgencyWithUsersRights;
  isPeAdvisorAllowed: boolean;
  isValidatorOfAgencyRefersToAllowed: boolean;
}): Promise<void> => {
  if ("userId" in jwtPayload) {
    const agency = await agencyWithRightToAgencyDto(uow, agencyWithUserRights);
    return onConnectedUser({
      uow,
      jwtPayload,
      authorizedRoles,
      errorToThrow,
      convention,
      agency,
      isPeAdvisorAllowed,
      isValidatorOfAgencyRefersToAllowed,
    });
  }

  if ("applicationId" in jwtPayload) {
    return onMagicLink({
      jwtPayload,
      authorizedRoles,
      errorToThrow,
      convention,
      isPeAdvisorAllowed,
    });
  }

  throw errorToThrow;
};

const onMagicLink = ({
  jwtPayload,
  authorizedRoles,
  errorToThrow,
  convention,
  isPeAdvisorAllowed,
}: {
  jwtPayload: ConventionDomainJwtPayload;
  authorizedRoles: Role[];
  errorToThrow: Error;
  convention: ConventionDto;
  isPeAdvisorAllowed: boolean;
}): void => {
  const { emailHash, role } = jwtPayload;

  throwErrorOnConventionIdMismatch({
    requestedConventionId: convention.id,
    jwtPayload,
  });

  const emailMatchesPeAdvisoremail = isHashMatchPeAdvisorEmail({
    beneficiary: convention.signatories.beneficiary,
    emailHash: jwtPayload.emailHash,
  });

  if (isPeAdvisorAllowed && emailMatchesPeAdvisoremail) {
    return;
  }

  if (!authorizedRoles.includes(role)) {
    throw errorToThrow;
  }

  const emails = conventionEmailsByRole(convention)(role);

  if (!isSomeEmailMatchingEmailHash(emails, emailHash))
    throw errors.convention.emailNotLinkedToConvention(role);
};

const onConnectedUser = async ({
  uow,
  jwtPayload,
  authorizedRoles,
  agency,
  isPeAdvisorAllowed,
  errorToThrow,
  convention,
  isValidatorOfAgencyRefersToAllowed,
}: {
  uow: UnitOfWork;
  jwtPayload: ConnectedUserDomainJwtPayload;
  agency: AgencyDto;
  authorizedRoles: Role[];
  errorToThrow: Error;
  convention: ConventionDto;
  isPeAdvisorAllowed: boolean;
  isValidatorOfAgencyRefersToAllowed: boolean;
}) => {
  const userWithRights = await getUserWithRights(uow, jwtPayload.userId);

  if (!isValidatorOfAgencyRefersToAllowed) {
    if (agency.refersToAgencyId) {
      const agencyRightOnAgency = userWithRights.agencyRights.find(
        (agencyRight) => agencyRight.agency.id === convention.agencyId,
      );

      if (
        agencyRightOnAgency &&
        !agencyRightOnAgency.roles.includes("counsellor") &&
        !agencyRightOnAgency.roles.includes("agency-admin") &&
        !agencyRightOnAgency.roles.includes("agency-viewer")
      )
        throw errors.convention.validatorOfAgencyRefersToNotAllowed();
    }
  }

  const roles = getConventionManageAllowedRoles(convention, userWithRights);
  if (roles.some((role) => authorizedRoles.includes(role))) return;
  throw errorToThrow;
};
