import {
  assessmentSignatureReminderAuthorizedRoles,
  CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
  type ConventionDto,
  type ConventionId,
  type ConventionRelatedJwtPayload,
  errors,
  formatHoursCooldownTimeRemaining,
  getFormattedFirstnameAndLastname,
  isBeforeAssessmentSignatureReleaseDate,
  isWithinHoursCooldown,
  type NotificationKind,
  type SendAssessmentLinkRequestDto,
  sendAssessmentLinkRequestSchema,
  type UserId,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../config/bootstrap/magicLinkUrl";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import type { CreateConventionMagicLinkPayloadProperties } from "../../../utils/jwt";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { SaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import type { NotificationRepository } from "../../core/notifications/ports/NotificationRepository";
import type { ShortLinkIdGeneratorGateway } from "../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { prepareConventionMagicShortLinkMaker } from "../../core/short-link/ShortLink";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { getOnlyAssessmentDto } from "../entities/AssessmentEntity";
import {
  retrieveConventionWithAgency,
  throwErrorIfSignatoryPhoneNumberNotValid,
  throwErrorOnConventionIdMismatch,
} from "../entities/Convention";

export type SendAssessmentSignatureReminder = ReturnType<
  typeof makeSendAssessmentSignatureReminder
>;

export const makeSendAssessmentSignatureReminder = useCaseBuilder(
  "SendAssessmentSignatureReminder",
)
  .withInput<SendAssessmentLinkRequestDto>(sendAssessmentLinkRequestSchema)
  .withOutput<void>()
  .withCurrentUser<ConventionRelatedJwtPayload>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
    timeGateway: TimeGateway;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    config: AppConfig;
    createNewEvent: CreateNewEvent;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: jwtPayload }) => {
    const { conventionId, notificationKind } = inputParams;
    throwErrorOnConventionIdMismatch({
      requestedConventionId: conventionId,
      jwtPayload,
    });

    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      conventionId,
    );

    throwErrorIfConventionStatusNotAllowed(
      convention.status,
      ["ACCEPTED_BY_VALIDATOR"],
      errors.assessment.sendAssessmentSignatureReminderNotAllowedForStatus({
        status: convention.status,
      }),
    );

    await throwIfNotAuthorizedForRole({
      uow,
      convention,
      agencyWithUserRights: agency,
      authorizedRoles: [...assessmentSignatureReminderAuthorizedRoles],
      errorToThrow:
        errors.assessment.sendAssessmentSignatureReminderForbidden(),
      jwtPayload,
      isPeAdvisorAllowed: true,
      isValidatorOfAgencyRefersToAllowed: true,
    });

    const assessment = (
      await uow.assessmentRepository.getByConventionIds([convention.id])
    ).at(0);

    if (!assessment) throw errors.assessment.notFound(convention.id);

    const assessmentDto = getOnlyAssessmentDto(assessment);
    if (!assessmentDto)
      throw errors.assessment.signNotAvailableForLegacyAssessment();

    if (assessmentDto.signedAt !== null)
      throw errors.assessment.alreadySigned(convention.id);

    if (assessmentDto.status === "DID_NOT_SHOW")
      throw errors.assessment.sendAssessmentSignatureReminderAssessmentNotEligible();

    if (isBeforeAssessmentSignatureReleaseDate(assessmentDto.createdAt))
      throw errors.assessment.signNotAvailableForLegacyAssessment();

    await throwErrorIfAssessmentSignatureReminderAlreadySent({
      timeGateway: deps.timeGateway,
      notificationKind,
      beneficiaryEmail: convention.signatories.beneficiary.email,
      beneficiaryPhoneNumber: convention.signatories.beneficiary.phone,
      notificationRepository: uow.notificationRepository,
      conventionId: convention.id,
    });

    if (notificationKind === "sms") {
      throwErrorIfSignatoryPhoneNumberNotValid({
        convention,
        signatoryKey: "beneficiary",
        signatoryRole: "beneficiary",
      });
      await sendAssessmentSignatureReminderSms({
        conventionMagicLinkPayload: {
          id: convention.id,
          role: convention.signatories.beneficiary.role,
          email: convention.signatories.beneficiary.email,
          now: deps.timeGateway.now(),
        },
        userId: "userId" in jwtPayload ? jwtPayload.userId : undefined,
        recipientPhone: convention.signatories.beneficiary.phone,
        uow,
        convention,
        ...deps,
      });
    }

    if (notificationKind === "email")
      await sendAssessmentSignatureReminderEmail({
        convention,
        conventionMagicLinkPayload: {
          id: convention.id,
          role: convention.signatories.beneficiary.role,
          email: convention.signatories.beneficiary.email,
          now: deps.timeGateway.now(),
        },
        uow,
        ...deps,
      });

    const event = deps.createNewEvent({
      topic: "AssessmentSignatureReminderManuallySent",
      payload: {
        convention,
        transport: notificationKind,
        triggeredBy:
          "userId" in jwtPayload
            ? {
                kind: "connected-user",
                userId: jwtPayload.userId,
              }
            : {
                kind: "convention-magic-link",
                role: jwtPayload.role,
              },
      },
    });

    await uow.outboxRepository.save(event);
  });

const sendAssessmentSignatureReminderEmail = async ({
  convention,
  conventionMagicLinkPayload,
  saveNotificationAndRelatedEvent,
  generateConventionMagicLinkUrl,
  shortLinkIdGeneratorGateway,
  config,
  uow,
}: {
  convention: ConventionDto;
  conventionMagicLinkPayload: CreateConventionMagicLinkPayloadProperties;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  uow: UnitOfWork;
}) => {
  const beneficiary = convention.signatories.beneficiary;

  const makeMagicShortLink = prepareConventionMagicShortLinkMaker({
    conventionMagicLinkPayload,
    uow,
    config,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
  });

  const assessmentSignatureLink = await makeMagicShortLink({
    targetRoute: "assessmentDocument",
    lifetime: "2Days",
  });

  await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      kind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
      recipients: [beneficiary.email],
      params: {
        conventionId: convention.id,
        beneficiaryFirstName: getFormattedFirstnameAndLastname({
          firstname: beneficiary.firstName,
        }),
        beneficiaryLastName: getFormattedFirstnameAndLastname({
          lastname: beneficiary.lastName,
        }),
        businessName: convention.businessName,
        internshipKind: convention.internshipKind,
        assessmentSignatureLink,
      },
    },
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
    },
  });
};

const sendAssessmentSignatureReminderSms = async ({
  conventionMagicLinkPayload,
  saveNotificationAndRelatedEvent,
  generateConventionMagicLinkUrl,
  shortLinkIdGeneratorGateway,
  config,
  convention,
  uow,
  recipientPhone,
  userId,
}: {
  conventionMagicLinkPayload: CreateConventionMagicLinkPayloadProperties;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  convention: ConventionDto;
  uow: UnitOfWork;
  recipientPhone: string;
  userId: UserId | undefined;
}) => {
  const makeShortMagicLink = prepareConventionMagicShortLinkMaker({
    config,
    conventionMagicLinkPayload,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
    uow,
  });

  const shortLink = await makeShortMagicLink({
    targetRoute: "assessmentDocument",
    lifetime: "2Days",
    extraQueryParams: { at_campaign: "sms-assessment-signature-reminder" },
  });

  await saveNotificationAndRelatedEvent(uow, {
    kind: "sms",
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
      userId,
    },
    templatedContent: {
      recipientPhone,
      kind: "ReminderForAssessmentSignature",
      params: { shortLink },
    },
  });
};

const throwErrorIfAssessmentSignatureReminderAlreadySent = async ({
  notificationRepository,
  timeGateway,
  notificationKind,
  conventionId,
  beneficiaryEmail,
  beneficiaryPhoneNumber,
}: {
  notificationRepository: NotificationRepository;
  timeGateway: TimeGateway;
  notificationKind: NotificationKind;
  conventionId: ConventionId;
  beneficiaryEmail: string;
  beneficiaryPhoneNumber: string;
}) => {
  const lastNotification =
    notificationKind === "sms"
      ? await notificationRepository.getLastSmsNotificationByFilter({
          smsKind: "ReminderForAssessmentSignature",
          conventionId,
          recipientPhoneNumber: beneficiaryPhoneNumber,
        })
      : await notificationRepository.getLastEmailNotificationByFilter({
          emailKind: "ASSESSMENT_NEEDS_SIGNATURE_BENEFICIARY_NOTIFICATION",
          conventionId,
          recipientEmail: beneficiaryEmail,
        });

  const lastNotificationCreatedAt =
    lastNotification && new Date(lastNotification.createdAt);

  if (
    lastNotificationCreatedAt &&
    isWithinHoursCooldown({
      lastActionAt: lastNotificationCreatedAt,
      minHours: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
      now: timeGateway.now(),
    })
  )
    throw errors.assessment.assessmentLinkAlreadySent({
      notificationKind,
      minHoursBetweenReminder: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
      timeRemaining: formatHoursCooldownTimeRemaining({
        lastActionAt: lastNotificationCreatedAt,
        minHours: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
        now: timeGateway.now(),
      }),
    });
};
