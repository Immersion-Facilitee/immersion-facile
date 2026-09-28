import {
  errors,
  frontRoutes,
  makeRouteAbsoluteUrl,
  withDiscussionIdSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { establishmentDeletedRejectionReason } from "./RejectDiscussionsForDeletedEstablishment";

export type NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted =
  ReturnType<
    typeof makeNotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted
  >;

export const makeNotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted =
  useCaseBuilder(
    "NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted",
  )
    .withInput(withDiscussionIdSchema)
    .withDeps<{
      saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
      config: AppConfig;
    }>()
    .build(async ({ inputParams: { discussionId }, uow, deps }) => {
      const discussion = await uow.discussionRepository.getById(discussionId);
      if (!discussion) throw errors.discussion.notFound({ discussionId });

      if (
        discussion.status !== "REJECTED" ||
        discussion.rejectionKind !== "OTHER" ||
        discussion.rejectionReason !== establishmentDeletedRejectionReason
      )
        throw errors.discussion.badStatus({
          discussionId,
          expectedStatus: "REJECTED",
        });

      await deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: {
          kind: "ESTABLISHMENT_DELETED_NOTIFICATION_TO_BENEFICIARY",
          recipients: [discussion.potentialBeneficiary.email],
          params: {
            beneficiaryFirstName: discussion.potentialBeneficiary.firstName,
            beneficiaryLastName: discussion.potentialBeneficiary.lastName,
            businessName: discussion.businessName,
            discussionCreatedAt: discussion.createdAt,
            searchPageUrl: makeRouteAbsoluteUrl({
              route: frontRoutes.search(),
              baseUrl: deps.config.immersionFacileBaseUrl,
            }),
          },
        },
        followedIds: {
          establishmentSiret: discussion.siret,
        },
      });
    });
