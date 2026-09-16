import { type DiscussionStatus, errors, withDiscussionIdSchema } from "shared";
import type { SaveNotificationsBatchAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyBeneficiaryToFollowUpContactRequest = ReturnType<
  typeof makeNotifyBeneficiaryToFollowUpContactRequest
>;

export const makeNotifyBeneficiaryToFollowUpContactRequest = useCaseBuilder(
  "NotifyBeneficiaryToFollowUpContactRequest",
)
  .withInput(withDiscussionIdSchema)
  .withDeps<{
    saveNotificationsBatchAndRelatedEvent: SaveNotificationsBatchAndRelatedEvent;
  }>()
  .build(async ({ inputParams: { discussionId }, uow, deps }) => {
    const discussion = await uow.discussionRepository.getById(discussionId);
    if (!discussion) throw errors.discussion.notFound({ discussionId });
    const statusToMatch: DiscussionStatus = "PENDING";
    if (discussion.status !== statusToMatch)
      throw errors.discussion.badStatus({
        discussionId,
        expectedStatus: statusToMatch,
      });

    const establishment =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        discussion.siret,
      );

    if (!establishment)
      throw errors.establishment.notFound({ siret: discussion.siret });

    const userRightToContact = establishment.userRights.find(
      (userRight) => userRight.isMainContactByPhone,
    );
    if (!userRightToContact)
      throw errors.establishment.contactUserNotFound({
        siret: discussion.siret,
      });

    const userToContact = await uow.userRepository.getById(
      userRightToContact.userId,
    );
    if (!userToContact)
      throw errors.user.notFound({ userId: userRightToContact.userId });

    if (!userRightToContact.phone) {
      throw errors.user.noContactPhone({ userId: userRightToContact.userId });
    }

    await deps.saveNotificationsBatchAndRelatedEvent(uow, [
      {
        kind: "email",
        templatedContent: {
          kind: "DISCUSSION_BENEFICIARY_FOLLOW_UP",
          recipients: [discussion.potentialBeneficiary.email],
          params: {
            beneficiaryFirstName: discussion.potentialBeneficiary.firstName,
            beneficiaryLastName: discussion.potentialBeneficiary.lastName,
            businessName: discussion.businessName,
            contactFirstName: userToContact.firstName,
            contactLastName: userToContact.lastName,
            contactJob: userRightToContact.job,
            contactPhone: userRightToContact.phone,
          },
        },
        followedIds: {
          establishmentSiret: discussion.siret,
        },
      },
    ]);
  });
