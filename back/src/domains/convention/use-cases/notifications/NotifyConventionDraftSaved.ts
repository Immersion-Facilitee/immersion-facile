import {
  type AbsoluteUrl,
  type ConventionDraftId,
  conventionDraftDetailSchema,
  conventionDraftIdSchema,
  type Email,
  emailSchema,
  errors,
  frontRoutes,
  makeRouteAbsoluteUrl,
} from "shared";
import z from "zod";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { makeShortLink } from "../../../core/short-link/ShortLink";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyConventionDraftSavedInputParams = {
  draftId: ConventionDraftId;
  senderEmail: Email | null;
  recipientEmail: Email | null;
  details: string | null;
};

const notifyConventionDraftSavedInputParamsSchema = z.object({
  draftId: conventionDraftIdSchema,
  senderEmail: emailSchema.nullable(),
  recipientEmail: emailSchema.nullable(),
  details: conventionDraftDetailSchema.nullable(),
});

export type NotifyConventionDraftSaved = ReturnType<
  typeof makeNotifyConventionDraftSaved
>;

export const makeNotifyConventionDraftSaved = useCaseBuilder(
  "NotifyConventionDraftSaved",
)
  .withInput(notifyConventionDraftSavedInputParamsSchema)
  .withDeps<{
    config: AppConfig;
    shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  }>()
  .build(
    async ({
      inputParams,
      uow,
      deps: {
        config,
        saveNotificationAndRelatedEvent,
        shortLinkIdGeneratorGateway,
      },
    }) => {
      if (!inputParams.recipientEmail && !inputParams.senderEmail) return;

      const draft = await uow.conventionDraftRepository.getById(
        inputParams.draftId,
      );

      if (!draft)
        throw errors.conventionDraft.notFound({
          conventionDraftId: inputParams.draftId,
        });

      const longLink: AbsoluteUrl = makeRouteAbsoluteUrl({
        route:
          draft.internshipKind === "immersion"
            ? frontRoutes.conventionImmersion({
                conventionDraftId: draft.id,
              })
            : frontRoutes.conventionMiniStage({
                conventionDraftId: draft.id,
              }),
        baseUrl: config.immersionFacileBaseUrl,
      });
      const conventionFormUrl = await makeShortLink({
        uow,
        longLink,
        shortLinkIdGeneratorGateway,
        config,
      });

      if (inputParams.senderEmail)
        await saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "SHARE_CONVENTION_DRAFT_SENDER",
            recipients: [inputParams.senderEmail],
            params: {
              conventionDraftId: draft.id,
              conventionFormUrl,
              internshipKind: draft.internshipKind,
            },
          },
          followedIds: {},
        });

      if (inputParams.recipientEmail)
        await saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "SHARE_CONVENTION_DRAFT_RECIPIENT",
            recipients: [inputParams.recipientEmail],
            params: {
              additionalDetails: inputParams.details ?? undefined,
              conventionDraftId: draft.id,
              conventionFormUrl,
              internshipKind: draft.internshipKind,
            },
          },
          followedIds: {},
        });
    },
  );
