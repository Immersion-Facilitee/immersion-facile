import {
  type AgencyDto,
  type AssessmentDto,
  type ConventionDto,
  type ConventionReadDto,
  isAssessmentDto,
  type LegacyAssessmentDto,
  type PickFromExistingKeys,
} from "shared";
import { toPartnerAgencyKind } from "../../../../utils/agency";
import type {
  BroadcastAgencyRefersTo,
  BroadcastAssessmentDto,
  BroadcastConventionDto,
  BroadcastConventionField,
} from "./broadcastConvention.dto";

export const toBroadcastConvention = (
  conventionRead: ConventionReadDto,
  agency: AgencyDto,
  refersToAgency: AgencyDto | null,
): BroadcastConventionDto => ({
  ...toBroadcastConventionFields(conventionRead),
  agencyName: agency.name,
  agencyDepartment: agency.address.departmentCode,
  agencyKind: toPartnerAgencyKind(agency.kind),
  agencySiret: agency.agencySiret,
  agencyCodeSafir: agency.codeSafir,
  agencyValidatorEmails: agency.validatorEmails,
  ...(refersToAgency
    ? { agencyRefersTo: toBroadcastAgencyRefersTo(refersToAgency) }
    : {}),
  ...(conventionRead.isEstablishmentBanned
    ? {
        isEstablishmentBanned: true,
        establishmentBannishmentJustification:
          conventionRead.establishmentBannishmentJustification,
      }
    : { isEstablishmentBanned: false }),
});

const toBroadcastConventionFields = (
  conventionRead: ConventionReadDto,
): PickFromExistingKeys<ConventionDto, BroadcastConventionField> => {
  const businessFields = {
    id: conventionRead.id,
    status: conventionRead.status,
    statusJustification: conventionRead.statusJustification,
    agencyId: conventionRead.agencyId,
    dateSubmission: conventionRead.dateSubmission,
    dateStart: conventionRead.dateStart,
    dateEnd: conventionRead.dateEnd,
    dateValidation: conventionRead.dateValidation,
    dateApproval: conventionRead.dateApproval,
    siret: conventionRead.siret,
    businessName: conventionRead.businessName,
    schedule: conventionRead.schedule,
    workConditions: conventionRead.workConditions,
    businessAdvantages: conventionRead.businessAdvantages,
    individualProtection: conventionRead.individualProtection,
    individualProtectionDescription:
      conventionRead.individualProtectionDescription,
    sanitaryPrevention: conventionRead.sanitaryPrevention,
    sanitaryPreventionDescription: conventionRead.sanitaryPreventionDescription,
    immersionAddress: conventionRead.immersionAddress,
    immersionObjective: conventionRead.immersionObjective,
    immersionAppellation: conventionRead.immersionAppellation,
    immersionActivities: conventionRead.immersionActivities,
    immersionSkills: conventionRead.immersionSkills,
    establishmentNumberEmployeesRange:
      conventionRead.establishmentNumberEmployeesRange,
    establishmentTutor: conventionRead.establishmentTutor,
    validators: conventionRead.validators,
    agencyReferent: conventionRead.agencyReferent,
    renewed: conventionRead.renewed,
    acquisitionCampaign: conventionRead.acquisitionCampaign,
    acquisitionKeyword: conventionRead.acquisitionKeyword,
  };

  if (conventionRead.internshipKind === "immersion")
    return {
      ...businessFields,
      internshipKind: conventionRead.internshipKind,
      signatories: conventionRead.signatories,
    };

  return {
    ...businessFields,
    internshipKind: conventionRead.internshipKind,
    signatories: conventionRead.signatories,
  };
};

const toBroadcastAgencyRefersTo = (
  refersToAgency: AgencyDto,
): BroadcastAgencyRefersTo => ({
  id: refersToAgency.id,
  name: refersToAgency.name,
  kind: toPartnerAgencyKind(refersToAgency.kind),
  siret: refersToAgency.agencySiret,
  codeSafir: refersToAgency.codeSafir,
});

export const toBroadcastAssessment = (
  assessment: AssessmentDto | LegacyAssessmentDto | undefined,
): BroadcastAssessmentDto | undefined => {
  if (!assessment || !isAssessmentDto(assessment)) return undefined;

  const {
    beneficiaryAgreement,
    beneficiaryFeedback,
    signedAt,
    createdAt,
    ...broadcastAssessment
  } = assessment;

  return broadcastAssessment;
};
