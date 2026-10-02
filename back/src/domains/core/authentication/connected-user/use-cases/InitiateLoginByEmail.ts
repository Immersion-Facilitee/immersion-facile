import {
  getFormattedFirstnameAndLastname,
  type InitiateLoginByEmailParams,
  immersionFacileNoReplyEmailSender,
  initiateLoginByEmailParamsSchema,
} from "shared";
import type { AppConfig } from "../../../../../config/bootstrap/appConfig";
import type { GenerateEmailAuthCodeUrl } from "../../../../../config/bootstrap/magicLinkUrl";
import type { SaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../useCaseBuilder";
import type { UuidGenerator } from "../../../uuid-generator/ports/UuidGenerator";

export type InitiateLoginByEmail = ReturnType<typeof makeInitiateLoginByEmail>;
export const makeInitiateLoginByEmail = useCaseBuilder("InitiateLoginByEmail")
  .withInput<InitiateLoginByEmailParams>(initiateLoginByEmailParamsSchema)
  .withOutput<void>()
  .withDeps<{
    config: AppConfig;
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    uuidGenerator: UuidGenerator;
    generateEmailAuthCodeUrl: GenerateEmailAuthCodeUrl;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ inputParams: { email, redirectUri }, uow, deps }) => {
    const nonce = deps.uuidGenerator.new();
    const state = deps.uuidGenerator.new();
    const { url: loginLink } = deps.generateEmailAuthCodeUrl({
      state,
      now: deps.timeGateway.now(),
      targetRoute: "magicLinkInterstitial",
      email,
    });

    const user = await uow.userRepository.findByEmail(email);

    await uow.ongoingOAuthRepository.save({
      fromUri: redirectUri,
      nonce,
      state,
      userId: user?.id,
      provider: "email",
      email,
      usedAt: null,
    });

    await deps.saveNotificationAndRelatedEvent(
      uow,
      {
        kind: "email",
        templatedContent: {
          kind: "LOGIN_BY_EMAIL_REQUESTED",
          recipients: [email],
          sender: immersionFacileNoReplyEmailSender,
          params: {
            validMinutes: deps.config.emailAuthCodeJwtDurationInMinutes,
            loginLink,
            fullname: getFormattedFirstnameAndLastname({
              firstname: user?.firstName,
              lastname: user?.lastName,
            }),
          },
        },
        followedIds: { userId: user?.id },
      },
      { priority: 1 },
    );
  });
