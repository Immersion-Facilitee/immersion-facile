import {
  createOpaqueEmail,
  discussionEmailSender,
  type Email,
  type EmailAttachment,
  type Exchange,
  errors,
  frontRoutes,
  makeRouteAbsoluteUrl,
  renderCTAInEmailContent,
  type SiretDto,
  type WithDiscussionId,
  withDiscussionIdSchema,
} from "shared";
import { z } from "zod";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import {
  triggeredBySchema,
  type WithTriggeredBy,
} from "../../../core/events/events";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { NotificationGateway } from "../../../core/notifications/ports/NotificationGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { getNotifiedUsersFromEstablishmentUserRights } from "../../helpers/businessContact.helpers";

type SendExchangeToRecipientParams = WithDiscussionId &
  Partial<WithTriggeredBy> & {
    skipSendingEmail?: boolean;
  };

export type SendExchangeToRecipient = ReturnType<
  typeof makeSendExchangeToRecipient
>;

export const makeSendExchangeToRecipient = useCaseBuilder(
  "SendExchangeToRecipient",
)
  .withInput<SendExchangeToRecipientParams>(
    withDiscussionIdSchema.and(
      z.object({
        triggeredBy: triggeredBySchema.optional(),
        skipSendingEmail: z.boolean().optional(),
      }),
    ),
  )
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    domain: string;
    notificationGateway: NotificationGateway;
    config: AppConfig;
  }>()
  .build(async ({ deps, inputParams, uow }) => {
    if (inputParams.skipSendingEmail) return;
    const discussion = await uow.discussionRepository.getById(
      inputParams.discussionId,
    );
    if (!discussion)
      throw errors.discussion.notFound({
        discussionId: inputParams.discussionId,
      });

    const lastExchange = discussion.exchanges.reduce<Exchange | undefined>(
      (acc, current) => (acc && acc.sentAt >= current.sentAt ? acc : current),
      undefined,
    );

    if (!lastExchange) throw errors.discussion.noExchanges(discussion.id);

    const appellation = (
      await uow.romeRepository.getAppellationAndRomeDtosFromAppellationCodesIfExist(
        [discussion.appellationCode],
      )
    ).at(0);

    if (!appellation)
      throw errors.rome.missingAppellation({
        appellationCode: discussion.appellationCode,
      });

    const attachments = (
      await Promise.all(
        lastExchange.attachments.map(async ({ name, link }) => ({
          name,
          content: await deps.notificationGateway.getAttachmentContent(link),
        })),
      )
    ).filter(
      (emailAttachment) => emailAttachment.content !== null,
    ) as EmailAttachment[];

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "DISCUSSION_EXCHANGE",
        sender: discussionEmailSender,
        params: {
          subject: lastExchange.subject,
          htmlContent: `
                  ⚠️ Important : Seule la personne destinataire de cet email est autorisée à répondre via Immersion Facilitée. 
                  Merci de ne pas transférer ce message : toute réponse envoyée depuis un autre compte ne pourra pas être transmise.
                  <div style="color: #b5b5b5; font-size: 12px">Pour rappel, voici les informations liées à cette mise en relation :
                  <br /><ul>
                  <li>Candidat : ${discussion.potentialBeneficiary.firstName} ${
                    discussion.potentialBeneficiary.lastName
                  }</li>
                  <li>Métier : ${appellation?.appellationLabel}</li>
                  <li>Entreprise : ${discussion.businessName} - ${
                    discussion.address.streetNumberAndAddress
                  } ${discussion.address.postcode} ${discussion.address.city}</li>
                  </ul><br />
                  ${renderCTAInEmailContent({
                    url: makeRouteAbsoluteUrl({
                      route:
                        lastExchange.sender === "establishment"
                          ? frontRoutes.beneficiaryDashboardDiscussions({
                              discussionId: discussion.id,
                              at_campaign:
                                "inbound-parsing-reponse-via-tableau-de-bord",
                            })
                          : frontRoutes.establishmentDashboardDiscussions({
                              discussionId: discussion.id,
                              at_campaign:
                                "inbound-parsing-reponse-via-tableau-de-bord",
                            }),
                      baseUrl: deps.config.immersionFacileBaseUrl,
                    }),
                    label: "Répondre depuis mon espace",
                  })}
                  </div>
            ${
              lastExchange.message.length
                ? lastExchange.message
                : "--- pas de message ---"
            }`,
        },
        recipients:
          lastExchange.sender === "establishment"
            ? [discussion.potentialBeneficiary.email]
            : await getEstablishmentNotifiedContactEmails(
                uow,
                discussion.siret,
              ),
        replyTo: {
          email: createOpaqueEmail({
            discussionId: discussion.id,
            recipient: {
              kind: lastExchange.sender,
              firstname:
                lastExchange.sender === "establishment"
                  ? lastExchange.firstname
                  : discussion.potentialBeneficiary.firstName,
              lastname:
                lastExchange.sender === "establishment"
                  ? lastExchange.lastname
                  : discussion.potentialBeneficiary.lastName,
            },
            replyDomain: `reply.${deps.domain}`,
          }),
          name:
            lastExchange.sender === "establishment"
              ? `${lastExchange.firstname} ${lastExchange.lastname} - ${discussion.businessName}`
              : `${discussion.potentialBeneficiary.firstName} ${discussion.potentialBeneficiary.lastName}`,
        },
        attachments,
      },
      followedIds: {
        ...(inputParams.triggeredBy?.kind === "connected-user"
          ? { userId: inputParams.triggeredBy.userId }
          : undefined),
        establishmentSiret: discussion.siret,
      },
    });
  });

const getEstablishmentNotifiedContactEmails = async (
  uow: UnitOfWork,
  siret: SiretDto,
): Promise<Email[]> => {
  const establishment =
    await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
      siret,
    );
  if (!establishment) throw errors.establishment.notFound({ siret });

  const notifiedUsers = await getNotifiedUsersFromEstablishmentUserRights(
    uow,
    establishment.userRights,
  );

  if (notifiedUsers.length === 0) {
    throw errors.establishment.noContactToNotify({
      siret,
    });
  }

  return notifiedUsers.map(({ email }) => email);
};
