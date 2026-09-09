import {
  agencyModifierRoles,
  allSignatoryRoles,
  CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
  type ConventionDto,
  type ConventionId,
  type ConventionRelatedJwtPayload,
  conventionSignatoryRoleBySignatoryKey,
  errors,
  formatHoursCooldownTimeRemaining,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isWithinHoursCooldown,
  makeRouteAbsoluteUrl,
  type NotificationKind,
  type SendSignatureLinkRequestDto,
  type SignatoryRole,
  sendSignatureLinkRequestSchema,
  type UserId,
} from "shared";
import type { AppConfig } from "../../../config/bootstrap/appConfig";
import { throwErrorIfConventionStatusNotAllowed } from "../../../utils/convention";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { SaveNotificationAndRelatedEvent } from "../../core/notifications/helpers/Notification";
import type { NotificationRepository } from "../../core/notifications/ports/NotificationRepository";
import type { ShortLinkIdGeneratorGateway } from "../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { makeShortLink } from "../../core/short-link/ShortLink";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import {
  retrieveConventionWithAgency,
  throwErrorIfSignatoryAlreadySigned,
  throwErrorIfSignatoryPhoneNumberNotValid,
  throwErrorOnConventionIdMismatch,
} from "../entities/Convention";

export type SendSignatureLink = ReturnType<typeof makeSendSignatureLink>;

export const makeSendSignatureLink = useCaseBuilder("RemindSignatories")
  .withInput<SendSignatureLinkRequestDto>(sendSignatureLinkRequestSchema)
  .withOutput<void>()
  .withCurrentUser<ConventionRelatedJwtPayload>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    timeGateway: TimeGateway;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    config: AppConfig;
    createNewEvent: CreateNewEvent;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: jwtPayload }) => {
    const { conventionId, signatoryRole, notificationKind } = inputParams;
    throwErrorOnConventionIdMismatch({
      requestedConventionId: conventionId,
      jwtPayload,
    });

    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      inputParams.conventionId,
    );

    throwErrorIfConventionStatusNotAllowed(
      convention.status,
      ["READY_TO_SIGN", "PARTIALLY_SIGNED"],
      errors.convention.sendSignatureLinkNotAllowedForStatus({
        status: convention.status,
      }),
    );

    await throwIfNotAuthorizedForRole({
      uow,
      convention,
      agencyWithUserRights: agency,
      authorizedRoles: [
        ...agencyModifierRoles,
        "back-office",
        ...allSignatoryRoles,
      ],
      errorToThrow: errors.convention.sendSignatureLinkNotAuthorizedForRole(),
      jwtPayload,
      isPeAdvisorAllowed: true,
      isValidatorOfAgencyRefersToAllowed: true,
    });

    const signatoryKey = conventionSignatoryRoleBySignatoryKey[signatoryRole];
    const signatory = convention.signatories[signatoryKey];
    if (!signatory) {
      throw errors.convention.missingActor({
        conventionId: convention.id,
        role: signatoryRole,
      });
    }

    throwErrorIfSignatoryAlreadySigned({
      convention,
      signatoryKey,
      signatoryRole,
    });

    await throwErrorIfSignatureLinkAlreadySent({
      timeGateway: deps.timeGateway,
      notificationKind,
      signatoryEmail: signatory.email,
      signatoryPhoneNumber: signatory.phone,
      signatoryRole: signatory.role,
      notificationRepository: uow.notificationRepository,
      conventionId: convention.id,
    });

    const commonParams = {
      userId: "userId" in jwtPayload ? jwtPayload.userId : undefined,
      signatoryPhone: signatory.phone,
      signatory,
      uow,
      convention,
      ...deps,
    };
    if (notificationKind === "sms") {
      throwErrorIfSignatoryPhoneNumberNotValid({
        convention,
        signatoryKey,
        signatoryRole,
      });
      await sendSms(commonParams);
    }
    if (notificationKind === "email") {
      await sendEmail(commonParams);
    }

    const event = deps.createNewEvent({
      topic: "ConventionSignatureLinkManuallySent",
      payload: {
        convention,
        recipientRole: signatory.role,
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

const sendSms = async ({
  saveNotificationAndRelatedEvent,
  shortLinkIdGeneratorGateway,
  config,
  convention,
  uow,
  signatoryPhone,
  userId,
  signatory,
}: {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  convention: ConventionDto;
  uow: UnitOfWork;
  signatoryPhone: string;
  userId: UserId | undefined;
  signatory: { role: SignatoryRole };
}) => {
  const shortLink = await makeShortLink({
    uow,
    shortLinkIdGeneratorGateway,
    config,
    longLink: makeRouteAbsoluteUrl({
      route: frontRoutes.manageConventionConnectedUser({
        conventionId: convention.id,
        loginPersona:
          signatory.role === "establishment-representative"
            ? "professional"
            : "beneficiary",
        at_campaign: "sms-signature-link",
      }),
      baseUrl: config.immersionFacileBaseUrl,
    }),
  });

  await saveNotificationAndRelatedEvent(uow, {
    kind: "sms",
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
      userId: userId,
    },
    templatedContent: {
      recipientPhone: signatoryPhone,
      kind: "ReminderForSignatories",
      params: { shortLink: shortLink },
    },
  });
};

const sendEmail = async ({
  saveNotificationAndRelatedEvent,
  config,
  convention,
  uow,
  signatory,
}: {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  config: AppConfig;
  convention: ConventionDto;
  uow: UnitOfWork;
  signatory: {
    email: string;
    firstName: string;
    lastName: string;
    role: SignatoryRole;
  };
}) => {
  await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    followedIds: {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
    },
    templatedContent: {
      kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
      recipients: [signatory.email],
      params: {
        conventionId: convention.id,
        internshipKind: convention.internshipKind,
        signatoryName: getFormattedFirstnameAndLastname({
          firstname: signatory.firstName,
          lastname: signatory.lastName,
        }),
        beneficiaryName: getFormattedFirstnameAndLastname({
          firstname: convention.signatories.beneficiary.firstName,
          lastname: convention.signatories.beneficiary.lastName,
        }),
        establishmentTutorName: getFormattedFirstnameAndLastname({
          firstname: convention.establishmentTutor.firstName,
          lastname: convention.establishmentTutor.lastName,
        }),
        establishmentRepresentativeName: getFormattedFirstnameAndLastname({
          firstname:
            convention.signatories.establishmentRepresentative.firstName,
          lastname: convention.signatories.establishmentRepresentative.lastName,
        }),
        beneficiaryRepresentativeName:
          convention.signatories.beneficiaryRepresentative &&
          getFormattedFirstnameAndLastname({
            firstname:
              convention.signatories.beneficiaryRepresentative.firstName,
            lastname: convention.signatories.beneficiaryRepresentative.lastName,
          }),
        beneficiaryCurrentEmployerName:
          convention.signatories.beneficiaryCurrentEmployer &&
          getFormattedFirstnameAndLastname({
            firstname:
              convention.signatories.beneficiaryCurrentEmployer.firstName,
            lastname:
              convention.signatories.beneficiaryCurrentEmployer.lastName,
          }),
        conventionSignatureLink: makeRouteAbsoluteUrl({
          route: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.id,
            loginPersona:
              signatory.role === "establishment-representative"
                ? "professional"
                : "beneficiary",
            at_campaign: "email-signature-link",
          }),
          baseUrl: config.immersionFacileBaseUrl,
        }),
        businessName: convention.businessName,
        agencyLogoUrl: undefined,
      },
    },
  });
};

const throwErrorIfSignatureLinkAlreadySent = async ({
  notificationRepository,
  timeGateway,
  notificationKind,
  conventionId,
  signatoryEmail,
  signatoryPhoneNumber,
  signatoryRole,
}: {
  notificationRepository: NotificationRepository;
  timeGateway: TimeGateway;
  notificationKind: NotificationKind;
  conventionId: ConventionId;
  signatoryEmail: string;
  signatoryPhoneNumber: string;
  signatoryRole: SignatoryRole;
}) => {
  const lastNotification =
    notificationKind === "sms"
      ? await notificationRepository.getLastSmsNotificationByFilter({
          smsKind: "ReminderForSignatories",
          conventionId,
          recipientPhoneNumber: signatoryPhoneNumber,
        })
      : await notificationRepository.getLastEmailNotificationByFilter({
          emailKind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
          conventionId,
          recipientEmail: signatoryEmail,
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
    throw errors.convention.signatureLinkAlreadySent({
      signatoryRole,
      notificationKind,
      minHoursBetweenReminder: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
      timeRemaining: formatHoursCooldownTimeRemaining({
        lastActionAt: lastNotificationCreatedAt,
        minHours: CONVENTION_MANUAL_REMINDER_COOLDOWN_IN_HOURS,
        now: timeGateway.now(),
      }),
    });
};
