import {
  type AgencyId,
  type Beneficiary,
  type ConventionActorRole,
  type ConventionDto,
  type Email,
  type EmailHash,
  errors,
  type GenericActor,
  type Role,
  type UserWithAdminRights,
} from "shared";
import type { UnitOfWork } from "../domains/core/unit-of-work/ports/UnitOfWork";
import { agencyWithRightToAgencyDto } from "./agency";
import { conventionActorByRole, conventionEmailsByRole } from "./convention";
import { makeEmailHash } from "./jwt";

export const isSomeEmailMatchingEmailHash = (
  emails: Email[],
  emailHash: EmailHash,
): boolean => emails.some((email) => makeEmailHash(email) === emailHash);

export const getAgencyEmailFromEmailHash = async (
  uow: UnitOfWork,
  agencyId: AgencyId,
  emailHash: string,
): Promise<Email> => {
  const agencyWithRights = await uow.agencyRepository.getById(agencyId);
  if (!agencyWithRights) throw errors.agency.notFound({ agencyId });
  const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);

  const agencyEmails = [...agency.validatorEmails, ...agency.counsellorEmails];

  const email = agencyEmails.find(
    (agencyEmail) => makeEmailHash(agencyEmail) === emailHash,
  );

  if (!email) throw errors.agency.emailNotFound({ agencyId });

  return email;
};

export const isHashMatchConventionEmails = ({
  convention,
  emailHash,
  role,
}: {
  convention: ConventionDto;
  emailHash: EmailHash;
  role: ConventionActorRole;
}): boolean => {
  const emailsByRole = conventionEmailsByRole(convention)(role);
  return isSomeEmailMatchingEmailHash(emailsByRole, emailHash);
};

export const getConventionActorMatchingEmailHashOrThrow = ({
  convention,
  emailHash,
  role,
}: {
  convention: ConventionDto;
  emailHash: EmailHash;
  role: ConventionActorRole;
}): GenericActor<ConventionActorRole> => {
  const actor = conventionActorByRole(convention)(role);

  if (!isSomeEmailMatchingEmailHash([actor.email], emailHash))
    throw errors.convention.forbiddenMissingRightsEmailHash({
      conventionId: convention.id,
      role,
      emailHash,
    });

  return actor;
};

export const isHashMatchPeAdvisorEmail = ({
  beneficiary,
  emailHash,
}: {
  beneficiary: Beneficiary<"immersion" | "mini-stage-cci">;
  emailHash: EmailHash;
}): boolean => {
  const peAdvisorEmail = beneficiary.federatedIdentity?.payload?.advisor?.email;

  return peAdvisorEmail
    ? isSomeEmailMatchingEmailHash([peAdvisorEmail], emailHash)
    : false;
};

export const makeHashByRolesForTest = (
  convention: ConventionDto,
  counsellor: UserWithAdminRights,
  validator: UserWithAdminRights,
): Record<Role, string> => ({
  "agency-admin": "N/A",
  "agency-viewer": "N/A",
  "back-office": "N/A",
  "beneficiary-current-employer": makeEmailHash(
    convention.signatories.beneficiaryCurrentEmployer?.email ?? "N/A",
  ),
  "beneficiary-representative": makeEmailHash(
    convention.signatories.beneficiaryRepresentative?.email ?? "N/A",
  ),
  "establishment-representative": makeEmailHash(
    convention.signatories.establishmentRepresentative.email,
  ),
  "to-review": "N/A",
  beneficiary: makeEmailHash(convention.signatories.beneficiary.email),
  "establishment-tutor": makeEmailHash(convention.establishmentTutor.email),
  counsellor: makeEmailHash(counsellor.email ?? "N/A"),
  validator: makeEmailHash(validator.email),
  "establishment-admin": "N/A",
  "establishment-contact": "N/A",
});
