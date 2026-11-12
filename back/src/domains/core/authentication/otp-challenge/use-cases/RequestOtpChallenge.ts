import { addMinutes, subMinutes, subSeconds } from "date-fns";
import {
  type ConventionActorRole,
  type ConventionDto,
  type Email,
  errors,
  executeInSequence,
  type GenericActor,
  immersionFacileNoReplyEmailSender,
  isValidMobilePhone,
  type NotificationKind,
  OTP_CHALLENGE_DURATION_IN_MINUTES,
  type OtpChallenge,
  type OtpCode,
  type PhoneNumber,
  type RequestOtpChallengeDto,
  requestOtpChallengeSchema,
  type VisitorOtpJwtPayload,
} from "shared";
import { match } from "ts-pattern";

import { getConventionActorMatchingEmailHashOrThrow } from "../../../../../utils/emailHash";
import type {
  NotificationContentAndFollowedIds,
  SaveNotificationAndRelatedEvent,
} from "../../../notifications/helpers/Notification";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { UuidGenerator } from "../../../uuid-generator/ports/UuidGenerator";
import type { HashOtpCode } from "../adapters/hashOtpCode";
import type { OtpCodeGeneratorGateway } from "../port/OtpCodeGeneratorGateway";

const MIN_SECONDS_BETWEEN_OTP_CHALLENGE_REQUESTS = 60;
const MAX_OTP_CHALLENGE_REQUESTS_PER_PERIOD = 5;
const OTP_CHALLENGE_REQUESTS_PERIOD_IN_MINUTES = 60;

export type RequestOtpChallenge = ReturnType<typeof makeRequestOtpChallenge>;

export const makeRequestOtpChallenge = useCaseBuilder("RequestOtpChallenge")
  .withInput<RequestOtpChallengeDto>(requestOtpChallengeSchema)
  .withCurrentUser<VisitorOtpJwtPayload>()
  .withDeps<{
    hashOtpCode: HashOtpCode;
    otpCodeGeneratorGateway: OtpCodeGeneratorGateway;
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    timeGateway: TimeGateway;
    uuidGenerator: UuidGenerator;
  }>()
  .build(async ({ inputParams: { channel }, currentUser, uow, deps }) =>
    match(currentUser.purpose)
      .with("manageConvention", async (): Promise<void> => {
        const { conventionId, emailHash, role } = currentUser.subject;

        const convention = await uow.conventionRepository.getById(conventionId);

        if (!convention) throw errors.convention.notFound({ conventionId });

        const actor = getConventionActorMatchingEmailHashOrThrow({
          convention,
          emailHash,
          role,
        });

        const now = deps.timeGateway.now();

        const otpChallenges =
          await uow.otpChallengeRepository.getByPurposeAndSubject({
            purpose: "manageConvention",
            subject: currentUser.subject,
          });

        throwIfOtpChallengeRequestsLimitReached({ otpChallenges, now });

        const otpChallengeId = deps.uuidGenerator.new();
        const otpCode = deps.otpCodeGeneratorGateway.generate();

        const { recipient, notification } = makeOtpNotification({
          channel,
          convention,
          role,
          actor,
          otpCode,
        });

        await executeInSequence(
          otpChallenges.filter(
            (otpChallenge) =>
              otpChallenge.usedAt === null && otpChallenge.revokedAt === null,
          ),
          ({ id }) => uow.otpChallengeRepository.revoke({ id, revokedAt: now }),
        );

        await uow.otpChallengeRepository.save({
          id: otpChallengeId,
          purpose: "manageConvention",
          subject: currentUser.subject,
          channel,
          recipient,
          codeHash: deps.hashOtpCode({ otpChallengeId, otpCode }),
          attempts: 0,
          expiresAt: addMinutes(
            now,
            OTP_CHALLENGE_DURATION_IN_MINUTES,
          ).toISOString(),
          usedAt: null,
          revokedAt: null,
          createdAt: now.toISOString(),
        });

        await deps.saveNotificationAndRelatedEvent(uow, notification, {
          priority: 1,
        });
      })
      .exhaustive(),
  );

const throwIfOtpChallengeRequestsLimitReached = ({
  otpChallenges,
  now,
}: {
  otpChallenges: OtpChallenge[];
  now: Date;
}): void => {
  const periodStart = subMinutes(now, OTP_CHALLENGE_REQUESTS_PERIOD_IN_MINUTES);
  const otpChallengesRequestedDuringPeriod = otpChallenges.filter(
    ({ createdAt }) => new Date(createdAt) >= periodStart,
  );
  const minCreatedAtForNewRequest = subSeconds(
    now,
    MIN_SECONDS_BETWEEN_OTP_CHALLENGE_REQUESTS,
  );

  if (
    otpChallengesRequestedDuringPeriod.some(
      ({ createdAt }) => new Date(createdAt) > minCreatedAtForNewRequest,
    )
  )
    throw errors.otpChallenge.requestedTooRecently({
      minSecondsBetweenRequests: MIN_SECONDS_BETWEEN_OTP_CHALLENGE_REQUESTS,
    });

  if (
    otpChallengesRequestedDuringPeriod.length >=
    MAX_OTP_CHALLENGE_REQUESTS_PER_PERIOD
  )
    throw errors.otpChallenge.tooManyRequests({
      maxRequests: MAX_OTP_CHALLENGE_REQUESTS_PER_PERIOD,
      periodInMinutes: OTP_CHALLENGE_REQUESTS_PERIOD_IN_MINUTES,
    });
};

type OtpNotification = {
  recipient: Email | PhoneNumber;
  notification: NotificationContentAndFollowedIds;
};

const makeOtpNotification = ({
  channel,
  convention,
  role,
  actor,
  otpCode,
}: {
  channel: NotificationKind;
  convention: ConventionDto;
  role: ConventionActorRole;
  actor: GenericActor<ConventionActorRole>;
  otpCode: OtpCode;
}): OtpNotification => {
  const followedIds = {
    conventionId: convention.id,
    agencyId: convention.agencyId,
    establishmentSiret: convention.siret,
  };

  return match(channel)
    .with(
      "email",
      (): OtpNotification => ({
        recipient: actor.email,
        notification: {
          kind: "email",
          templatedContent: {
            kind: "REQUEST_OTP_CODE",
            recipients: [actor.email],
            sender: immersionFacileNoReplyEmailSender,
            params: { otpCode },
          },
          followedIds,
        },
      }),
    )
    .with("sms", (): OtpNotification => {
      if (!isValidMobilePhone(actor.phone))
        throw errors.convention.invalidMobilePhoneNumber({
          conventionId: convention.id,
          role,
        });

      return {
        recipient: actor.phone,
        notification: {
          kind: "sms",
          templatedContent: {
            kind: "RequestOtpCode",
            recipientPhone: actor.phone,
            params: { otpCode },
          },
          followedIds,
        },
      };
    })
    .exhaustive();
};
