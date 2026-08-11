import {
  type AgencyDto,
  type AgencyId,
  type AgencyWithUsersRights,
  type ConnectedUser,
  type ConnectedUserDomainJwtPayload,
  type ConventionDomainJwtPayload,
  type ConventionDto,
  type ConventionRelatedJwtPayload,
  errors,
  type Role,
  type UserWithAdminRights,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { conventionEmailsByRole } from "../../../utils/convention";
import { isHashMatchPeAdvisorEmail } from "../../../utils/emailHash";
import { isSomeEmailMatchingEmailHash } from "../../../utils/jwt";
import { throwErrorOnConventionIdMismatch } from "../../convention/entities/Convention";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { getUserWithRights } from "./userRights.helper";

export const throwIfNotAdmin = (user: UserWithAdminRights | undefined) => {
  if (!user) throw errors.user.unauthorized();
  if (!user.isBackofficeAdmin) throw errors.user.forbidden({ userId: user.id });
};

export const throwIfNotAgencyAdminOrBackofficeAdmin = (
  agencyId: AgencyId,
  currentUser?: ConnectedUser,
): void => {
  if (!currentUser) throw errors.user.unauthorized();
  if (currentUser.isBackofficeAdmin) return;

  const hasPermission = currentUser.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.id === agencyId &&
      agencyRight.roles.includes("agency-admin"),
  );

  if (!hasPermission) {
    throw errors.user.forbidden({ userId: currentUser.id });
  }
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
  const agency = await agencyWithRightToAgencyDto(uow, agencyWithUserRights);
  if ("userId" in jwtPayload) {
    await onConnectedUser({
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
    await onMagicLink({
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
};

const onMagicLink = async ({
  uow,
  jwtPayload,
  authorizedRoles,
  errorToThrow,
  convention,
  agency,
  isPeAdvisorAllowed,
  isValidatorOfAgencyRefersToAllowed,
}: {
  uow: UnitOfWork;
  jwtPayload: ConventionDomainJwtPayload;
  authorizedRoles: Role[];
  errorToThrow: Error;
  convention: ConventionDto;
  agency: AgencyDto;
  isPeAdvisorAllowed: boolean;
  isValidatorOfAgencyRefersToAllowed: boolean;
}) => {
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

  const emailsOrError = conventionEmailsByRole(convention, agency)(role);

  if (!isSomeEmailMatchingEmailHash(emailsOrError, emailHash))
    throw errors.convention.emailNotLinkedToConvention(role);

  // Validate agency refers to logic for applicationId payload
  if (!isValidatorOfAgencyRefersToAllowed) {
    const agency = await uow.agencyRepository.getById(convention.agencyId);

    if (!agency)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    if (agency.refersToAgencyId) {
      if (role === "validator")
        throw errors.convention.validatorOfAgencyRefersToNotAllowed();
    }
  }
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

  if (
    userWithRights.isBackofficeAdmin &&
    authorizedRoles.includes("back-office")
  ) {
    return;
  }

  if (
    userWithRights.email === convention.signatories.beneficiary.email &&
    authorizedRoles.includes("beneficiary")
  ) {
    return;
  }

  if (
    userWithRights.email ===
      convention.signatories.establishmentRepresentative.email &&
    authorizedRoles.includes("establishment-representative")
  ) {
    return;
  }

  if (
    userWithRights.email === convention.establishmentTutor.email &&
    authorizedRoles.includes("establishment-tutor")
  ) {
    return;
  }

  const hasAuthorizedAgencyRole = userWithRights.agencyRights.some(
    (agencyRight) =>
      agencyRight.agency.id === convention.agencyId &&
      agencyRight.roles.some((role) => authorizedRoles.includes(role)),
  );

  if (hasAuthorizedAgencyRole) {
    return;
  }

  const hasAuthorizedEstablishmentRole = userWithRights.establishments?.some(
    (establishmentRight) =>
      authorizedRoles.includes(establishmentRight.role) &&
      establishmentRight.siret === convention.siret,
  );

  if (hasAuthorizedEstablishmentRole) {
    return;
  }

  throw errorToThrow;
};
