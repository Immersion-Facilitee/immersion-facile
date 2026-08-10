import { uniq } from "ramda";
import {
  type AgencyDto,
  type AgencyId,
  type AgencyUserConventionListDto,
  type AgencyWithUsersRights,
  type ConventionAssessmentFields,
  type ConventionDto,
  type ConventionId,
  type ConventionLastReminders,
  type ConventionReadDto,
  type ConventionRole,
  type ConventionStatus,
  conventionLastRemindersSchema,
  type Email,
  errors,
  executeInSequence,
  isTruthy,
  makeEmptyLastReminders,
  type SiretDto,
  type WithBannedEstablishmentInformations,
} from "shared";
import type { AssessmentEntity } from "../domains/convention/entities/AssessmentEntity";
import type { NotificationRepository } from "../domains/core/notifications/ports/NotificationRepository";
import type { UnitOfWork } from "../domains/core/unit-of-work/ports/UnitOfWork";
import type { BannedEstablishment } from "../domains/establishment/ports/BannedEstablishmentRepository";
import { agencyDtoToConventionAgencyFields } from "./agency";

export const conventionEmailsByRole =
  (convention: ConventionDto, agency: AgencyDto) =>
  (role: ConventionRole): Email[] => {
    const emailsByRole: Record<ConventionRole, Email[] | Error | undefined> = {
      beneficiary: [convention.signatories.beneficiary.email],
      "beneficiary-current-employer": convention.signatories
        .beneficiaryCurrentEmployer
        ? [convention.signatories.beneficiaryCurrentEmployer.email]
        : errors.convention.missingActor({
            conventionId: convention.id,
            role: "beneficiary-current-employer",
          }),
      "beneficiary-representative": convention.signatories
        .beneficiaryRepresentative
        ? [convention.signatories.beneficiaryRepresentative.email]
        : errors.convention.missingActor({
            conventionId: convention.id,
            role: "beneficiary-representative",
          }),
      counsellor: agency.counsellorEmails,
      validator: agency.validatorEmails,
      "establishment-representative": [
        convention.signatories.establishmentRepresentative.email,
      ],
      "establishment-tutor": [convention.establishmentTutor.email],
    };
    const emails = emailsByRole[role as ConventionRole];

    if (!emails) throw errors.convention.roleHasNoMagicLink({ role });
    if (emails instanceof Error) throw emails;
    return emails;
  };

export const conventionDtosToConventionReadDtos = async (
  conventions: ConventionDto[],
  uow: UnitOfWork,
): Promise<ConventionReadDto[]> => {
  if (conventions.length === 0) return [];

  const allAgenciesWithRightsById = await getAgencyInfosForConventionRead(
    conventions,
    uow,
  );
  const bannedBySiret = await getBannedEstablishmentsBySiret(conventions, uow);
  const assessmentByConventionId = await getAssessmentsByConventionId(
    conventions,
    uow,
  );
  const lastRemindersList = await executeInSequence(conventions, (convention) =>
    getConventionLastRemindersFields(convention, uow.notificationRepository),
  );

  return conventions.map((convention, index) => {
    const agency = allAgenciesWithRightsById[convention.agencyId];

    const bannedEstablishment = bannedBySiret[convention.siret];
    const withBannedEstablishmentInformations: WithBannedEstablishmentInformations =
      bannedEstablishment
        ? {
            isEstablishmentBanned: true,
            establishmentBannishmentJustification:
              bannedEstablishment.establishmentBannishmentJustification,
          }
        : { isEstablishmentBanned: false };

    return {
      ...convention,
      ...agencyDtoToConventionAgencyFields(
        agency,
        agency.refersToAgencyId
          ? (allAgenciesWithRightsById[agency.refersToAgencyId] ?? null)
          : null,
      ),
      ...assesmentEntityToConventionAssessmentFields(
        assessmentByConventionId[convention.id],
      ),
      ...withBannedEstablishmentInformations,
      lastReminders: lastRemindersList[index],
    };
  });
};

const getAgencyInfosForConventionRead = async (
  conventions: ConventionDto[],
  uow: UnitOfWork,
): Promise<Record<AgencyId, AgencyWithUsersRights>> => {
  const agencyIds = uniq(conventions.map(({ agencyId }) => agencyId));
  const agenciesWithRights = await uow.agencyRepository.getByIds(agencyIds);
  const agencyWithRightsById = Object.fromEntries(
    agenciesWithRights.map((agency) => [agency.id, agency]),
  );

  const refersToAgencyIds = uniq(
    agenciesWithRights
      .map(({ refersToAgencyId }) => refersToAgencyId)
      .filter(isTruthy)
      .filter((id) => !agencyWithRightsById[id]),
  );

  const refersToAgenciesWithRights = (
    await executeInSequence(refersToAgencyIds, (id) =>
      uow.agencyRepository.getById(id),
    )
  ).filter(isTruthy);

  const refersToAgenciesWithRightsById = Object.fromEntries(
    refersToAgenciesWithRights.map((agency) => [agency.id, agency]),
  );

  return {
    ...agencyWithRightsById,
    ...refersToAgenciesWithRightsById,
  };
};

const getBannedEstablishmentsBySiret = async (
  conventions: ConventionDto[],
  uow: UnitOfWork,
): Promise<Record<SiretDto, BannedEstablishment | undefined>> => {
  const bannedBySiretEntries = await executeInSequence(
    uniq(conventions.map(({ siret }) => siret)),
    async (siret) => {
      const banned =
        await uow.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
          siret,
        );
      return [siret, banned] as const;
    },
  );

  return bannedBySiretEntries.reduce<
    Record<SiretDto, BannedEstablishment | undefined>
  >((acc, [siret, banned]) => ({ ...acc, [siret]: banned }), {});
};

const getAssessmentsByConventionId = async (
  conventions: ConventionDto[],
  uow: UnitOfWork,
): Promise<Record<ConventionId, AssessmentEntity>> => {
  const assessments = await uow.assessmentRepository.getByConventionIds(
    conventions.map(({ id }) => id),
  );

  return assessments.reduce<Record<ConventionId, AssessmentEntity>>(
    (acc, assessment) => ({
      ...acc,
      [assessment.conventionId]: assessment,
    }),
    {},
  );
};

export const assesmentEntityToConventionAssessmentFields = (
  assessmentEntity: AssessmentEntity | undefined,
): ConventionAssessmentFields => {
  if (!assessmentEntity) return { assessment: null };

  return assessmentEntity.status === "COMPLETED" ||
    assessmentEntity.status === "PARTIALLY_COMPLETED" ||
    assessmentEntity.status === "DID_NOT_SHOW"
    ? {
        assessment: {
          status: assessmentEntity.status,
          endedWithAJob: assessmentEntity.endedWithAJob,
          signedAt: assessmentEntity.signedAt ?? null,
          createdAt: assessmentEntity.createdAt,
        },
      }
    : {
        assessment: {
          status: assessmentEntity.status,
          createdAt: assessmentEntity.createdAt,
        },
      };
};

export const conventionDtosToAgencyUserConventionListDtos = async (
  conventions: ConventionDto[],
  uow: UnitOfWork,
): Promise<AgencyUserConventionListDto[]> => {
  if (conventions.length === 0) return [];

  const agencyIds = uniq(conventions.map(({ agencyId }) => agencyId));
  const [agencies, assessments] = await Promise.all([
    uow.agencyRepository.getByIds(agencyIds),
    uow.assessmentRepository.getByConventionIds(
      conventions.map(({ id }) => id),
    ),
  ]);
  const agencyById = Object.fromEntries(
    agencies.map((agency) => [agency.id, agency]),
  );

  const assessmentByConventionId = assessments.reduce<
    Record<ConventionId, AssessmentEntity>
  >(
    (acc, assessment) => ({
      ...acc,
      [assessment.conventionId]: assessment,
    }),
    {},
  );

  return conventions.map((convention) => {
    const agency = agencyById[convention.agencyId];
    if (!agency)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const { beneficiary } = convention.signatories;

    const federatedIdentity = beneficiary.federatedIdentity
      ? {
          provider: beneficiary.federatedIdentity.provider,
          ...(beneficiary.federatedIdentity.payload
            ? { payload: beneficiary.federatedIdentity.payload }
            : {}),
        }
      : undefined;

    return {
      id: convention.id,
      status: convention.status,
      dateStart: convention.dateStart,
      dateEnd: convention.dateEnd,
      businessName: convention.businessName,
      agencyName: agency.name,
      agencyReferent: convention.agencyReferent,
      assessment: assesmentEntityToConventionAssessmentFields(
        assessmentByConventionId[convention.id],
      ).assessment,
      beneficiary: {
        firstName: beneficiary.firstName,
        lastName: beneficiary.lastName,
        federatedIdentity,
      },
    };
  });
};

const getConventionLastRemindersFields = async (
  convention: ConventionDto,
  notificationRepository: NotificationRepository,
): Promise<ConventionLastReminders> => {
  const [
    conventionSignatureReminders,
    assessmentCompletionEmail,
    assessmentCompletionSms,
    assessmentSignatureEmail,
    assessmentSignatureSms,
  ] = await Promise.all([
    Promise.all(
      Object.values(convention.signatories)
        .filter(isTruthy)
        .map(async ({ role, email, phone }) => {
          const [emailNotification, smsNotification] = await Promise.all([
            notificationRepository.getLastEmailNotificationByFilter({
              conventionId: convention.id,
              emailKind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
              recipientEmail: email,
            }),
            notificationRepository.getLastSmsNotificationByFilter({
              conventionId: convention.id,
              smsKind: "ReminderForSignatories",
              recipientPhoneNumber: phone,
            }),
          ]);
          return {
            role,
            email: emailNotification?.createdAt ?? null,
            sms: smsNotification?.createdAt ?? null,
          };
        }),
    ),
    notificationRepository.getLastEmailNotificationByFilter({
      conventionId: convention.id,
      emailKind: "ASSESSMENT_ESTABLISHMENT_NOTIFICATION",
      recipientEmail: convention.establishmentTutor.email,
    }),
    notificationRepository.getLastSmsNotificationByFilter({
      conventionId: convention.id,
      smsKind: "ReminderForAssessment",
      recipientPhoneNumber: convention.establishmentTutor.phone,
    }),
    notificationRepository.getLastEmailNotificationByFilter({
      conventionId: convention.id,
      emailKind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
      recipientEmail: convention.signatories.beneficiary.email,
    }),
    notificationRepository.getLastSmsNotificationByFilter({
      conventionId: convention.id,
      smsKind: "ReminderForAssessmentSignature",
      recipientPhoneNumber: convention.signatories.beneficiary.phone,
    }),
  ]);

  return conventionLastRemindersSchema.parse({
    conventionSignatures: {
      ...makeEmptyLastReminders().conventionSignatures,
      ...Object.fromEntries(
        conventionSignatureReminders.map(({ role, email, sms }) => [
          role,
          { email, sms },
        ]),
      ),
    },
    assessmentCompletion: {
      email: assessmentCompletionEmail?.createdAt ?? null,
      sms: assessmentCompletionSms?.createdAt ?? null,
    },
    assessmentSignature: {
      email: assessmentSignatureEmail?.createdAt ?? null,
      sms: assessmentSignatureSms?.createdAt ?? null,
    },
  });
};

export const throwErrorIfConventionStatusNotAllowed = (
  status: ConventionStatus,
  allowedStatuses: ConventionStatus[],
  errorToThrow: Error,
) => {
  if (!allowedStatuses.includes(status)) {
    throw errorToThrow;
  }
};
